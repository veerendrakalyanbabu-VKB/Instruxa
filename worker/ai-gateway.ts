export type AiProvider = "openai" | "anthropic" | "gemini";
export type GatewayUser = { id: string; name: string; email: string };
export interface AiEnv {
  DB: D1Database;
  BYOK_MASTER_KEY?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

const providers: AiProvider[] = ["openai", "anthropic", "gemini"];
const defaults: Record<AiProvider,string> = {openai:"gpt-5-mini",anthropic:"claude-sonnet-5",gemini:"gemini-3.6-flash"};
type OpenAiResponse={output_text?:string;output?:Array<{content?:Array<{type?:string;text?:string}>}>;usage?:{input_tokens?:number;output_tokens?:number};error?:{message?:string}};
type AnthropicResponse={content?:Array<{type?:string;text?:string}>;usage?:{input_tokens?:number;output_tokens?:number};error?:{message?:string}};
type GeminiResponse={steps?:Array<{type?:string;content?:Array<{type?:string;text?:string}>}>;usage?:{input_tokens?:number;output_tokens?:number};error?:{message?:string}};
type Evaluation={overall:number;structure:number;completeness:number;actionability:number;constraintFit:number;signals:string[]};
const j=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const uid=()=>crypto.randomUUID();
const providerOf=(value:unknown):AiProvider|null=>providers.includes(value as AiProvider)?value as AiProvider:null;
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const unb64=(value:string)=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));

async function masterKey(env:AiEnv){
  if(!env.BYOK_MASTER_KEY)throw new Error("BYOK_NOT_CONFIGURED");
  const raw=unb64(env.BYOK_MASTER_KEY);
  if(raw.length!==32)throw new Error("BYOK_MASTER_KEY_INVALID");
  return crypto.subtle.importKey("raw",raw,"AES-GCM",false,["encrypt","decrypt"]);
}
async function encrypt(secret:string,env:AiEnv){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await crypto.subtle.encrypt({name:"AES-GCM",iv},await masterKey(env),new TextEncoder().encode(secret));return{ciphertext:b64(new Uint8Array(data)),iv:b64(iv)}}
async function decrypt(ciphertext:string,iv:string,env:AiEnv){const data=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(iv)},await masterKey(env),unb64(ciphertext));return new TextDecoder().decode(data)}
const platformKey=(provider:AiProvider,env:AiEnv)=>provider==="openai"?env.OPENAI_API_KEY:provider==="anthropic"?env.ANTHROPIC_API_KEY:env.GEMINI_API_KEY;
const transientStatuses=new Set([408,429,500,502,503,504]);
const delay=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchWithRetry(url:string,init:RequestInit){
 let response:Response|undefined;
 for(let attempt=0;attempt<3;attempt++){
  try{response=await fetch(url,init)}catch(error){if(attempt===2)throw error;await delay(500*(2**attempt)+Math.floor(Math.random()*250));continue}
  if(!transientStatuses.has(response.status)||attempt===2)return response;
  const retryAfter=Number(response.headers.get("retry-after"));
  await response.body?.cancel();
  await delay(Number.isFinite(retryAfter)&&retryAfter>0?Math.min(retryAfter*1000,5000):700*(2**attempt)+Math.floor(Math.random()*300));
 }
 return response as Response;
}

function clamp(value:number){return Math.max(0,Math.min(100,Math.round(value)))}
function evaluate(prompt:string,text:string):Evaluation{
 const headings=(text.match(/^#{1,4}\s+/gm)||[]).length,bullets=(text.match(/^\s*[-*]\s+/gm)||[]).length,numbered=(text.match(/^\s*\d+[.)]\s+/gm)||[]).length;
 const code=(text.match(/```/g)||[]).length>=2,tables=/^\|.+\|$/m.test(text),sections=["summary","architecture","implementation","security","test","risk"].filter(x=>text.toLowerCase().includes(x)).length;
 const promptRules=(prompt.match(/^\s*[-*]\d.]\s+/gm)||[]).length,outputWords=text.trim().split(/\s+/).filter(Boolean).length;
 const structure=clamp(38+headings*7+Math.min(18,(bullets+numbered)*2)+(tables?10:0)+(code?8:0));
 const completeness=clamp(30+Math.min(35,outputWords/18)+sections*6);
 const actionability=clamp(32+Math.min(28,(bullets+numbered)*3)+(code?16:0)+(\/\b(implement|configure|validate|deploy|test|create|use)\b/i.test(text)?14:0));
 const constraintFit=clamp(48+Math.min(24,promptRules*3)+Math.min(24,sections*4)+(text.length>400?4:0));
 const signals=[headings?`${headings} structured sections`:"Narrative response",bullets+numbered?`${bullets+numbered} actionable items`:"No explicit action list",code?"Implementation examples included":"No fenced implementation example",tables?"Comparison table included":"No comparison table"].slice(0,4);
 return{overall:clamp((structure+completeness+actionability+constraintFit)/4),structure,completeness,actionability,constraintFit,signals};
}
function parseEvaluation(value:unknown){try{return JSON.parse(String(value||"{}")) as Evaluation}catch{return null}}

async function callProvider(provider:AiProvider,model:string,prompt:string,key:string){
  if(provider==="openai"){
    const response=await fetchWithRetry("https://api.openai.com/v1/responses",{method:"POST",headers:{authorization:`Bearer ${key}`,"content-type":"application/json"},body:JSON.stringify({model,input:prompt,max_output_tokens:1800})});
    const data=await response.json() as OpenAiResponse;if(!response.ok)throw new Error(`PROVIDER:${response.status}:${data?.error?.message||"OpenAI request failed after automatic retries"}`);
    const text=String(data.output_text??data.output?.flatMap(x=>x.content??[]).filter(x=>x.type==="output_text").map(x=>x.text).join("\n")??"");
    return{text,inputTokens:Number(data.usage?.input_tokens??0),outputTokens:Number(data.usage?.output_tokens??0)};
  }
  if(provider==="anthropic"){
    const response=await fetchWithRetry("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"x-api-key":key,"anthropic-version":"2023-06-01","content-type":"application/json"},body:JSON.stringify({model,max_tokens:1800,messages:[{role:"user",content:prompt}]})});
    const data=await response.json() as AnthropicResponse;if(!response.ok)throw new Error(`PROVIDER:${response.status}:${data?.error?.message||"Anthropic request failed after automatic retries"}`);
    return{text:(data.content??[]).filter(x=>x.type==="text").map(x=>x.text).join("\n"),inputTokens:Number(data.usage?.input_tokens??0),outputTokens:Number(data.usage?.output_tokens??0)};
  }
  const response=await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/interactions",{method:"POST",headers:{"x-goog-api-key":key,"content-type":"application/json"},body:JSON.stringify({model,input:prompt,store:false})});
  const data=await response.json() as GeminiResponse;if(!response.ok)throw new Error(`PROVIDER:${response.status}:${data?.error?.message||"Gemini is still busy after automatic retries. Please try again shortly."}`);
  const text=(data.steps??[]).filter(x=>x.type==="model_output").flatMap(x=>x.content??[]).filter(x=>x.type==="text").map(x=>x.text??"").join("\n");
  return{text,inputTokens:Number(data.usage?.input_tokens??0),outputTokens:Number(data.usage?.output_tokens??0)};
}

export async function handleAiApi(request:Request,env:AiEnv,user:GatewayUser):Promise<Response>{
 const url=new URL(request.url),method=request.method;
 try{
  if(url.pathname==="/api/ai/config"&&method==="GET"){
   const keys=await env.DB.prepare("SELECT provider,key_last4 AS keyLast4,updated_at AS updatedAt FROM provider_keys WHERE user_id=? ORDER BY provider").bind(user.id).all();
   const credits=await env.DB.prepare("SELECT balance FROM credit_accounts WHERE user_id=?").bind(user.id).first<{balance:number}>();
   return j({keys:keys.results,credits:credits?.balance??25,platform:{openai:Boolean(env.OPENAI_API_KEY),anthropic:Boolean(env.ANTHROPIC_API_KEY),gemini:Boolean(env.GEMINI_API_KEY)},defaults});
  }
  if(url.pathname==="/api/ai/keys"&&method==="POST"){
   const input=await request.json() as Record<string,unknown>,provider=providerOf(input.provider),apiKey=String(input.apiKey??"").trim();
   if(!provider||apiKey.length<16||apiKey.length>500)return j({error:"Select a provider and enter a valid API key."},400);
   const sealed=await encrypt(apiKey,env);
   await env.DB.prepare(`INSERT INTO provider_keys(id,user_id,provider,ciphertext,iv,key_last4) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,provider) DO UPDATE SET ciphertext=excluded.ciphertext,iv=excluded.iv,key_last4=excluded.key_last4,updated_at=datetime('now')`).bind(uid(),user.id,provider,sealed.ciphertext,sealed.iv,apiKey.slice(-4)).run();
   return j({ok:true,provider,keyLast4:apiKey.slice(-4)},201);
  }
  const keyMatch=url.pathname.match(/^\/api\/ai\/keys\/(openai|anthropic|gemini)$/);
  if(keyMatch&&method==="DELETE"){await env.DB.prepare("DELETE FROM provider_keys WHERE user_id=? AND provider=?").bind(user.id,keyMatch[1]).run();return j({ok:true})}
  if(url.pathname==="/api/ai/runs"&&method==="DELETE"){
   try{await env.DB.prepare("DELETE FROM ai_runs WHERE user_id=?").bind(user.id).run();return j({ok:true})}
   catch(error){if(String(error).includes("no such table"))return j({error:"Response Lab migration is not applied."},503);throw error}
  }
  if(url.pathname==="/api/ai/runs"&&method==="GET"){
   try{
    const rows=await env.DB.prepare("SELECT id,provider,model,access_mode AS accessMode,response_text AS text,input_tokens AS inputTokens,output_tokens AS outputTokens,latency_ms AS latencyMs,evaluation_json AS evaluation,created_at AS createdAt FROM ai_runs WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(user.id).all();
    return j({runs:(rows.results as Array<Record<string,unknown>>).map(row=>({...row,evaluation:parseEvaluation(row.evaluation)})),migrationRequired:false});
   }catch(error){if(String(error).includes("no such table"))return j({runs:[],migrationRequired:true});throw error}
  }
  const runMatch=url.pathname.match(/^\/api\/ai\/runs\/([0-9a-f-]+)$/i);
  if(runMatch&&method==="DELETE"){
   try{const result=await env.DB.prepare("DELETE FROM ai_runs WHERE id=? AND user_id=?").bind(runMatch[1],user.id).run();return result.meta.changes?j({ok:true}):j({error:"Run not found."},404)}
   catch(error){if(String(error).includes("no such table"))return j({error:"Response Lab migration is not applied."},503);throw error}
  }
  if(url.pathname==="/api/ai/usage"&&method==="GET"){
   const events=await env.DB.prepare("SELECT id,provider,model,access_mode AS accessMode,input_tokens AS inputTokens,output_tokens AS outputTokens,credits_used AS creditsUsed,status,created_at AS createdAt FROM usage_events WHERE user_id=? ORDER BY created_at DESC LIMIT 50").bind(user.id).all();return j({events:events.results});
  }
  if(url.pathname==="/api/ai/generate"&&method==="POST"){
   const input=await request.json() as Record<string,unknown>,provider=providerOf(input.provider),prompt=String(input.prompt??"").trim(),mode=input.mode==="included"?"included":"byok";
   if(!provider||prompt.length<3||prompt.length>30000)return j({error:"Provider and a prompt between 3 and 30,000 characters are required."},400);
   const recent=await env.DB.prepare("SELECT COUNT(*) AS count FROM usage_events WHERE user_id=? AND created_at > datetime('now','-1 minute')").bind(user.id).first<{count:number}>();if((recent?.count??0)>=10)return j({error:"Rate limit reached. Try again in one minute."},429);
   const model=String(input.model??defaults[provider]).trim().slice(0,120)||defaults[provider];let key:string|undefined,charged=false;
   if(mode==="included"){
    key=platformKey(provider,env);if(!key)return j({error:`Included ${provider} access is not active yet. Connect your own API key.`},503);
    await env.DB.prepare("INSERT OR IGNORE INTO credit_accounts(user_id,balance) VALUES(?,25)").bind(user.id).run();
    const charge=await env.DB.prepare("UPDATE credit_accounts SET balance=balance-1,updated_at=datetime('now') WHERE user_id=? AND balance>0").bind(user.id).run();if(!charge.meta.changes)return j({error:"No included credits remain."},402);charged=true;
   }else{
    const row=await env.DB.prepare("SELECT ciphertext,iv FROM provider_keys WHERE user_id=? AND provider=?").bind(user.id,provider).first<{ciphertext:string;iv:string}>();if(!row)return j({error:`Connect a ${provider} API key first.`},400);key=await decrypt(row.ciphertext,row.iv,env);
   }
   const eventId=uid(),started=Date.now();
   try{
    const result=await callProvider(provider,model,prompt,key),latencyMs=Date.now()-started,evaluation=evaluate(prompt,result.text);
    await env.DB.prepare("INSERT INTO usage_events(id,user_id,provider,model,access_mode,input_tokens,output_tokens,credits_used,status,latency_ms) VALUES(?,?,?,?,?,?,?,?,?,?)").bind(eventId,user.id,provider,model,mode,result.inputTokens,result.outputTokens,charged?1:0,"succeeded",latencyMs).run();
    try{await env.DB.prepare("INSERT INTO ai_runs(id,user_id,provider,model,access_mode,prompt,response_text,input_tokens,output_tokens,latency_ms,evaluation_json) VALUES(?,?,?,?,?,?,?,?,?,?,?)").bind(eventId,user.id,provider,model,mode,prompt,result.text,result.inputTokens,result.outputTokens,latencyMs,JSON.stringify(evaluation)).run()}catch(historyError){if(!String(historyError).includes("no such table"))console.warn("Instruxa run history write failed",historyError)}
    const credits=await env.DB.prepare("SELECT balance FROM credit_accounts WHERE user_id=?").bind(user.id).first<{balance:number}>();
    return j({id:eventId,...result,provider,model,mode,credits:credits?.balance??25,latencyMs,evaluation});
   }
   catch(error){if(charged)await env.DB.prepare("UPDATE credit_accounts SET balance=balance+1 WHERE user_id=?").bind(user.id).run();const detail=error instanceof Error?error.message:"Provider request failed";await env.DB.prepare("INSERT INTO usage_events(id,user_id,provider,model,access_mode,credits_used,status,error_code,latency_ms) VALUES(?,?,?,?,?,?,?,?,?)").bind(eventId,user.id,provider,model,mode,0,"failed",detail.split(":").slice(0,2).join(":"),Date.now()-started).run();if(detail.startsWith("PROVIDER:")){const parts=detail.split(":");return j({error:parts.slice(2).join(":")||"Provider rejected the request."},Number(parts[1])||502)}throw error;}
  }
  return j({error:"Not found."},404);
 }catch(error){const detail=error instanceof Error?error.message:String(error);console.error("Instruxa AI gateway",detail);if(detail==="BYOK_NOT_CONFIGURED")return j({error:"BYOK_MASTER_KEY is missing from the Worker runtime secrets."},503);if(detail==="BYOK_MASTER_KEY_INVALID")return j({error:"BYOK_MASTER_KEY must be valid Base64 that decodes to exactly 32 bytes."},503);if(detail.includes("no such table"))return j({error:"AI database migration is not applied."},503);return j({error:"AI request could not be completed."},500)}
}
