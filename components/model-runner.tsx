"use client";
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Clipboard, Clock3, Download, KeyRound, LoaderCircle, Play, RotateCcw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Provider="openai"|"anthropic"|"gemini";
type Config={keys:Array<{provider:Provider;keyLast4:string}>;credits:number;platform:Record<Provider,boolean>;defaults:Record<Provider,string>};
type Usage={inputTokens:number;outputTokens:number};
type Evaluation={overall:number;structure:number;completeness:number;actionability:number;constraintFit:number;signals:string[]};
type Run={id:string;provider:Provider;model:string;text:string;usage?:Usage;inputTokens?:number;outputTokens?:number;latencyMs?:number;evaluation?:Evaluation|null;isWinner?:boolean;createdAt:string};
const labels:Record<Provider,string>={openai:"OpenAI",anthropic:"Claude",gemini:"Gemini"};
const fallbackDefaults:Record<Provider,string>={openai:"gpt-5-mini",anthropic:"claude-sonnet-5",gemini:"gemini-3.6-flash"};
const modelCatalog:Record<Provider,Array<{id:string;label:string}>>={
 openai:[{id:"gpt-5-mini",label:"GPT-5 mini · Fast & efficient"},{id:"gpt-5.4",label:"GPT-5.4 · Advanced"}],
 anthropic:[{id:"claude-sonnet-5",label:"Claude Sonnet 5 · Balanced"},{id:"claude-haiku-4-5-20251001",label:"Claude Haiku 4.5 · Fast"}],
 gemini:[{id:"gemini-3.6-flash",label:"Gemini 3.6 Flash · Recommended"}],
};
async function call<T>(url:string,options?:RequestInit):Promise<T>{const response=await fetch(url,{...options,headers:{"content-type":"application/json",...options?.headers}});const data=await response.json() as T&{error?:string};if(!response.ok)throw new Error(data.error||"Request failed");return data}

function inline(text:string):ReactNode[]{
 const tokens=text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
 return tokens.map((part,index)=>{
  if(part.startsWith("**")&&part.endsWith("**"))return <strong key={index}>{part.slice(2,-2)}</strong>;
  if(part.startsWith("`")&&part.endsWith("`"))return <code key={index}>{part.slice(1,-1)}</code>;
  const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
  if(link)return <a key={index} href={link[2]} target="_blank" rel="noreferrer">{link[1]}</a>;
  return <Fragment key={index}>{part}</Fragment>;
 });
}
function Markdown({text}:{text:string}){
 const lines=text.replace(/\r/g,"").split("\n"),blocks:ReactNode[]=[];let code:string[]|null=null,list:string[]=[];
 const flushList=()=>{if(list.length){blocks.push(<ul key={"list-"+blocks.length}>{list.map((item,i)=><li key={i}>{inline(item)}</li>)}</ul>);list=[]}};
 lines.forEach((line,index)=>{
  if(line.trim().startsWith("```")){flushList();if(code){blocks.push(<pre key={"code-"+index}><code>{code.join("\n")}</code></pre>);code=null}else code=[];return}
  if(code){code.push(line);return}
  const heading=line.match(/^(#{1,4})\s+(.+)$/);if(heading){flushList();const level=heading[1].length,body=inline(heading[2]);blocks.push(level===1?<h1 key={index}>{body}</h1>:level===2?<h2 key={index}>{body}</h2>:level===3?<h3 key={index}>{body}</h3>:<h4 key={index}>{body}</h4>);return}
  const item=line.match(/^\s*[-*]\s+(.+)$/);if(item){list.push(item[1]);return}
  flushList();if(!line.trim()){blocks.push(<div className="md-gap" key={index}/>);return}
  blocks.push(<p key={index}>{inline(line)}</p>);
 });flushList();if(code)blocks.push(<pre key="code-last"><code>{code.join("\n")}</code></pre>);
 return <div className="model-markdown">{blocks}</div>;
}

export function ModelRunner({prompt}:{prompt:string}){
 const [config,setConfig]=useState<Config|null>(null),[provider,setProvider]=useState<Provider>("openai"),[mode,setMode]=useState<"byok"|"included">("byok"),[model,setModel]=useState("gpt-5-mini"),[apiKey,setApiKey]=useState(""),[output,setOutput]=useState(""),[usage,setUsage]=useState<Usage|null>(null),[evaluation,setEvaluation]=useState<Evaluation|null>(null),[history,setHistory]=useState<Run[]>([]),[comparison,setComparison]=useState<Run[]>([]),[selectedRuns,setSelectedRuns]=useState<string[]>([]),[migrationRequired,setMigrationRequired]=useState(false),[busy,setBusy]=useState(false),[comparing,setComparing]=useState(false),[synthesizing,setSynthesizing]=useState(false),[message,setMessage]=useState(""),[copied,setCopied]=useState(false);
 const load=useCallback(async()=>{try{const next=await call<Config>("/api/ai/config");setConfig(next)}catch(e){const text=e instanceof Error?e.message:"Sign in to use the model gateway";if(!text.toLowerCase().includes("authentication"))setMessage(text)}},[]);
 const loadRuns=useCallback(async()=>{try{const data=await call<{runs:Run[];migrationRequired:boolean}>("/api/ai/runs");setHistory(data.runs);setMigrationRequired(data.migrationRequired)}catch(e){const text=e instanceof Error?e.message:"";if(!text.toLowerCase().includes("authentication"))setMessage(text)}},[]);
 useEffect(()=>{void call<Config>("/api/ai/config").then(next=>{setConfig(next);setModel(next.defaults.openai);void loadRuns()}).catch(e=>{const text=e instanceof Error?e.message:"Sign in to use the model gateway";if(!text.toLowerCase().includes("authentication"))setMessage(text)})},[loadRuns]);
 useEffect(()=>{const sync=()=>{void load();void loadRuns()};window.addEventListener("instruxa-auth-changed",sync);return()=>window.removeEventListener("instruxa-auth-changed",sync)},[load,loadRuns]);
 const connected=useMemo(()=>config?.keys.find(x=>x.provider===provider),[config,provider]);
 function selectProvider(next:Provider){setProvider(next);setModel(config?.defaults?.[next]||fallbackDefaults[next]);setOutput("");setUsage(null);setEvaluation(null);setMessage("")}
 function remember(run:Run){setHistory(current=>[run,...current.filter(x=>x.id!==run.id)].slice(0,50))}
 async function saveKey(){setBusy(true);setMessage("");try{await call("/api/ai/keys",{method:"POST",body:JSON.stringify({provider,apiKey})});setApiKey("");await load();setMessage(`${labels[provider]} key encrypted and connected.`)}catch(e){setMessage(e instanceof Error?e.message:"Key connection failed")}finally{setBusy(false)}}
 async function removeKey(){if(!confirm(`Remove your ${labels[provider]} key?`))return;setBusy(true);try{await call(`/api/ai/keys/${provider}`,{method:"DELETE"});await load();setMessage("Key removed.")}catch(e){setMessage(e instanceof Error?e.message:"Removal failed")}finally{setBusy(false)}}
 async function run(){
  setBusy(true);setMessage("");setOutput("");setUsage(null);setEvaluation(null);
  try{
   const response=await fetch("/api/ai/generate-stream",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({provider,model,mode,prompt})});
   if(!response.ok){const failure=await response.json() as {error?:string};throw new Error(failure.error||"Generation failed")}
   if(!response.body)throw new Error("Streaming is unavailable in this browser.");
   const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",finalText="",completed=false;
   while(true){const chunk=await reader.read();if(chunk.done)break;buffer+=decoder.decode(chunk.value,{stream:true});const lines=buffer.split("\n");buffer=lines.pop()||"";
    for(const line of lines){if(!line.trim())continue;const event=JSON.parse(line) as {type:string;text?:string;error?:string;id?:string;inputTokens?:number;outputTokens?:number;credits?:number;latencyMs?:number;evaluation?:Evaluation};
     if(event.type==="delta"&&event.text){finalText+=event.text;setOutput(finalText)}
     if(event.type==="error")throw new Error(event.error||"Provider stream failed")
     if(event.type==="done"&&event.id&&event.evaluation){const nextUsage={inputTokens:event.inputTokens||0,outputTokens:event.outputTokens||0};setUsage(nextUsage);setEvaluation(event.evaluation);remember({id:event.id,provider,model,text:finalText,usage:nextUsage,latencyMs:event.latencyMs,evaluation:event.evaluation,createdAt:new Date().toISOString()});if(config&&typeof event.credits==="number")setConfig({...config,credits:event.credits});completed=true}
    }
   }
   if(!completed)throw new Error("The provider stream ended before completion.");setMessage("Stream completed and saved securely.");void loadRuns()
  }catch(e){setMessage(e instanceof Error?e.message:"Generation failed")}finally{setBusy(false)}
 }
 async function copyOutput(){await navigator.clipboard.writeText(output);setCopied(true);setTimeout(()=>setCopied(false),1400)}
 function download(){const blob=new Blob([output],{type:"text/markdown;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`instruxa-${provider}-response.md`;a.click();URL.revokeObjectURL(url)}
 function openRun(item:Run){setProvider(item.provider);setModel(item.model);setOutput(item.text);setUsage(item.usage||{inputTokens:item.inputTokens||0,outputTokens:item.outputTokens||0});setEvaluation(item.evaluation||null);setMessage(`Viewing ${labels[item.provider]} run from ${new Date(item.createdAt).toLocaleString()}.`)}
 function toggleRun(id:string){setSelectedRuns(current=>current.includes(id)?current.filter(x=>x!==id):current.length<3?[...current,id]:current)}
 async function markWinner(item:Run){try{await call(`/api/ai/runs/${item.id}/winner`,{method:"POST"});setComparison(current=>current.map(x=>({...x,isWinner:x.id===item.id})));setHistory(current=>current.map(x=>({...x,isWinner:x.id===item.id||x.isWinner})));setMessage(`${labels[item.provider]} marked as a Response Lab winner.`)}catch(e){setMessage(e instanceof Error?e.message:"Winner selection failed")}}
 async function synthesize(){
  if(selectedRuns.length<2){setMessage("Select at least two responses to synthesize.");return}setSynthesizing(true);setMessage("");
  try{const result=await call<{id:string;text:string;inputTokens:number;outputTokens:number;latencyMs:number;evaluation:Evaluation}>("/api/ai/synthesize",{method:"POST",body:JSON.stringify({runIds:selectedRuns,provider,model})});const nextUsage={inputTokens:result.inputTokens,outputTokens:result.outputTokens};setOutput(result.text);setUsage(nextUsage);setEvaluation(result.evaluation);remember({id:result.id,provider,model,text:result.text,usage:nextUsage,latencyMs:result.latencyMs,evaluation:result.evaluation,createdAt:new Date().toISOString()});setSelectedRuns([]);setMessage("Best-response synthesis completed securely.");void loadRuns()}catch(e){setMessage(e instanceof Error?e.message:"Synthesis failed")}finally{setSynthesizing(false)}
 }
 async function compareModels(){
  if(!config)return;const available=config.keys.map(x=>x.provider).filter((value,index,array)=>array.indexOf(value)===index);
  if(available.length<2){setMessage("Connect at least two provider keys to compare models side by side.");return}
  setComparing(true);setMessage("");setComparison([]);
  const settled=await Promise.allSettled(available.slice(0,3).map(async nextProvider=>{const nextModel=config.defaults[nextProvider]||fallbackDefaults[nextProvider];const result=await call<{id:string;text:string;inputTokens:number;outputTokens:number;latencyMs:number;evaluation:Evaluation}>("/api/ai/generate",{method:"POST",body:JSON.stringify({provider:nextProvider,model:nextModel,mode:"byok",prompt})});return{id:result.id,provider:nextProvider,model:nextModel,text:result.text,usage:{inputTokens:result.inputTokens,outputTokens:result.outputTokens},latencyMs:result.latencyMs,evaluation:result.evaluation,createdAt:new Date().toISOString()} as Run}));
  const complete=settled.filter((item):item is PromiseFulfilledResult<Run>=>item.status==="fulfilled").map(item=>item.value);complete.forEach(remember);setComparison(complete);void loadRuns();
  const failed=settled.length-complete.length;setMessage(complete.length?`Comparison complete across ${complete.length} model${complete.length===1?"":"s"}${failed?`; ${failed} provider run failed`:""}.`:"The connected providers could not complete this comparison.");setComparing(false)
 }
 return <section id="model-runner" className="runner-section"><div className="runner-head"><div><span className="eyebrow">SECURE MULTI-MODEL GATEWAY</span><h2>Run the prompt against real AI.</h2><p>Your key is encrypted before storage, never returned to the browser, and only decrypted inside the Worker for your selected provider.</p></div><div className="credit-chip"><ShieldCheck size={15}/><strong>{config?.credits??"—"}</strong><span>included credits</span></div></div>
 <div className="runner-grid"><div className="runner-controls"><label>Provider<select value={provider} onChange={e=>selectProvider(e.target.value as Provider)}>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Model<select value={model} onChange={e=>setModel(e.target.value)}>{modelCatalog[provider].map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select><small className="model-sync">Auto-synced with {labels[provider]}</small></label><div className="access-tabs"><button className={mode==="byok"?"active":""} onClick={()=>setMode("byok")}><KeyRound size={14}/>Own API key</button><button className={mode==="included"?"active":""} onClick={()=>setMode("included")}><Bot size={14}/>Included credits</button></div>{mode==="byok"&&<div className="key-box">{connected?<div className="connected-key"><CheckCircle2 size={16}/><span>{labels[provider]} connected ·•••• {connected.keyLast4}</span><Button size="sm" variant="ghost" onClick={removeKey} disabled={busy}><Trash2 size={14}/></Button></div>:<><Input type="password" autoComplete="off" placeholder={`Paste your ${labels[provider]} API key`} value={apiKey} onChange={e=>setApiKey(e.target.value)}/><Button onClick={saveKey} disabled={busy||apiKey.length<16}><KeyRound size={14}/>Encrypt & connect</Button></>}</div>}{mode==="included"&&!config?.platform[provider]&&<p className="runner-notice">Included {labels[provider]} access is not funded yet. BYOK is available without platform markup.</p>}<Button className="glow h-11" onClick={run} disabled={busy||!prompt||!config}>{busy?<LoaderCircle className="runner-spinner" size={16}/>:<Play size={15}/>} {busy?"Running securely…":"Run compiled prompt"}</Button><Button className="compare-button" onClick={compareModels} disabled={busy||comparing||!config}>{comparing?<LoaderCircle className="runner-spinner" size={15}/>:<Bot size={15}/>} {comparing?"Comparing securely…":"Compare connected models"}</Button>{migrationRequired&&<p className="runner-notice">Apply <code>migrations/0003_response_lab.sql</code> to activate cross-device run history.</p>}{message&&<p className="runner-message" role="status">{message}</p>}
 {history.length>0&&<div className="run-history"><div><Clock3 size={13}/><span>RECENT RUNS</span></div>{history.slice(0,8).map(item=><button key={item.id} onClick={()=>openRun(item)}><span>{labels[item.provider]} · {item.model}{item.evaluation?.overall?` · ${item.evaluation.overall}/100`:""}</span><small>{new Date(item.createdAt).toLocaleString()}</small></button>)}</div>}</div>
 <div className="runner-output"><div className="runner-output-head"><span>MODEL RESPONSE</span>{evaluation&&<b className="quality-score">{evaluation.overall} quality</b>}{usage&&<small>{usage.inputTokens} input · {usage.outputTokens} output tokens</small>}<Button size="sm" variant="ghost" disabled={!output} onClick={copyOutput}><Clipboard size={14}/>{copied?"Copied":"Copy"}</Button><Button size="sm" variant="ghost" disabled={!output} onClick={download}><Download size={14}/>Export</Button></div>{busy?<div className="runner-empty"><LoaderCircle className="runner-spinner" size={30}/><strong>{labels[provider]} is engineering your response</strong><span>Secure execution is in progress. Keep this tab open.</span></div>:output?<Markdown text={output}/>:<div className="runner-empty"><Bot size={30}/><strong>Ready for a real model run</strong><span>Connect a provider key or choose included access when available.</span></div>}{output&&!busy&&<div className="response-footer"><span><CheckCircle2 size={13}/> Secure run complete</span><Button size="sm" variant="ghost" onClick={run}><RotateCcw size={13}/>Run again</Button></div>}</div></div>{comparison.length>0&&<div className="comparison-lab"><div className="comparison-title"><span className="eyebrow">RESPONSE LAB</span><h3>Model comparison</h3><p>Compare quality, latency, token usage, and the complete response before selecting a winner.</p></div><div className="synthesis-bar"><span>{selectedRuns.length} selected</span><p>Select two or more candidates, then consolidate their strongest parts.</p><Button onClick={synthesize} disabled={selectedRuns.length<2||synthesizing}>{synthesizing?<LoaderCircle className="runner-spinner" size={14}/>:<Sparkles size={14}/>} {synthesizing?"Synthesizing…":`Synthesize with ${labels[provider]}`}</Button></div><div className="comparison-grid">{comparison.map(item=><article className={selectedRuns.includes(item.id)?"selected":""} key={item.id}><header><div><strong>{labels[item.provider]} {item.isWinner&&<span className="winner-badge">WINNER</span>}</strong><small>{item.model}</small></div><b>{item.evaluation?.overall??"—"}<span>/100</span></b></header><div className="comparison-actions"><button onClick={()=>toggleRun(item.id)}>{selectedRuns.includes(item.id)?"Selected":"Select for synthesis"}</button><button onClick={()=>markWinner(item)}>Mark winner</button></div><div className="comparison-metrics"><span>{item.latencyMs??0} ms</span><span>{item.usage?.outputTokens??0} output tokens</span></div><Markdown text={item.text}/></article>)}</div></div>}</section>
}