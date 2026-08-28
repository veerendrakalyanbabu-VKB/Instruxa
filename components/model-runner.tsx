"use client";
import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Clipboard, Clock3, Download, KeyRound, LoaderCircle, Play, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Provider="openai"|"anthropic"|"gemini";
type Config={keys:Array<{provider:Provider;keyLast4:string}>;credits:number;platform:Record<Provider,boolean>;defaults:Record<Provider,string>};
type Usage={inputTokens:number;outputTokens:number};
type Run={id:string;provider:Provider;model:string;text:string;usage:Usage;createdAt:string};
const labels:Record<Provider,string>={openai:"OpenAI",anthropic:"Claude",gemini:"Gemini"};
const fallbackDefaults:Record<Provider,string>={openai:"gpt-5-mini",anthropic:"claude-sonnet-5",gemini:"gemini-3.6-flash"};
const modelCatalog:Record<Provider,Array<{id:string;label:string}>>={
 openai:[{id:"gpt-5-mini",label:"GPT-5 mini · Fast & efficient"},{id:"gpt-5.4",label:"GPT-5.4 · Advanced"}],
 anthropic:[{id:"claude-sonnet-5",label:"Claude Sonnet 5 · Balanced"},{id:"claude-haiku-4-5-20251001",label:"Claude Haiku 4.5 · Fast"}],
 gemini:[{id:"gemini-3.6-flash",label:"Gemini 3.6 Flash · Recommended"}],
};
const HISTORY_KEY="instruxa:model-runs:v1";
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
 const [config,setConfig]=useState<Config|null>(null),[provider,setProvider]=useState<Provider>("openai"),[mode,setMode]=useState<"byok"|"included">("byok"),[model,setModel]=useState("gpt-5-mini"),[apiKey,setApiKey]=useState(""),[output,setOutput]=useState(""),[usage,setUsage]=useState<Usage|null>(null),[history,setHistory]=useState<Run[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[copied,setCopied]=useState(false);
 const load=useCallback(async()=>{try{const next=await call<Config>("/api/ai/config");setConfig(next)}catch(e){const text=e instanceof Error?e.message:"Sign in to use the model gateway";if(!text.toLowerCase().includes("authentication"))setMessage(text)}},[]);
 useEffect(()=>{void call<Config>("/api/ai/config").then(next=>{setConfig(next);setModel(next.defaults.openai)}).catch(e=>{const text=e instanceof Error?e.message:"Sign in to use the model gateway";if(!text.toLowerCase().includes("authentication"))setMessage(text)});try{const saved=localStorage.getItem(HISTORY_KEY);if(saved)setHistory(JSON.parse(saved).slice(0,5))}catch{}},[]);
 useEffect(()=>{const sync=()=>void load();window.addEventListener("instruxa-auth-changed",sync);return()=>window.removeEventListener("instruxa-auth-changed",sync)},[load]);
 const connected=useMemo(()=>config?.keys.find(x=>x.provider===provider),[config,provider]);
 function selectProvider(next:Provider){setProvider(next);setModel(config?.defaults?.[next]||fallbackDefaults[next]);setOutput("");setUsage(null);setMessage("")}
 function remember(run:Run){setHistory(current=>{const next=[run,...current.filter(x=>x.id!==run.id)].slice(0,5);try{localStorage.setItem(HISTORY_KEY,JSON.stringify(next))}catch{}return next})}
 async function saveKey(){setBusy(true);setMessage("");try{await call("/api/ai/keys",{method:"POST",body:JSON.stringify({provider,apiKey})});setApiKey("");await load();setMessage(`${labels[provider]} key encrypted and connected.`)}catch(e){setMessage(e instanceof Error?e.message:"Key connection failed")}finally{setBusy(false)}}
 async function removeKey(){if(!confirm(`Remove your ${labels[provider]} key?`))return;setBusy(true);try{await call(`/api/ai/keys/${provider}`,{method:"DELETE"});await load();setMessage("Key removed.")}catch(e){setMessage(e instanceof Error?e.message:"Removal failed")}finally{setBusy(false)}}
 async function run(){setBusy(true);setMessage("");setOutput("");setUsage(null);try{const result=await call<{id:string;text:string;inputTokens:number;outputTokens:number;credits:number}>("/api/ai/generate",{method:"POST",body:JSON.stringify({provider,model,mode,prompt})});const nextUsage={inputTokens:result.inputTokens,outputTokens:result.outputTokens};setOutput(result.text);setUsage(nextUsage);remember({id:result.id,provider,model,text:result.text,usage:nextUsage,createdAt:new Date().toISOString()});if(config)setConfig({...config,credits:result.credits});setMessage("Model response completed securely.")}catch(e){setMessage(e instanceof Error?e.message:"Generation failed")}finally{setBusy(false)}}
 async function copyOutput(){await navigator.clipboard.writeText(output);setCopied(true);setTimeout(()=>setCopied(false),1400)}
 function download(){const blob=new Blob([output],{type:"text/markdown;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`instruxa-${provider}-response.md`;a.click();URL.revokeObjectURL(url)}
 function openRun(item:Run){setProvider(item.provider);setModel(item.model);setOutput(item.text);setUsage(item.usage);setMessage(`Viewing ${labels[item.provider]} run from ${new Date(item.createdAt).toLocaleString()}.`)}
 return <section id="model-runner" className="runner-section"><div className="runner-head"><div><span className="eyebrow">SECURE MULTI-MODEL GATEWAY</span><h2>Run the prompt against real AI.</h2><p>Your key is encrypted before storage, never returned to the browser, and only decrypted inside the Worker for your selected provider.</p></div><div className="credit-chip"><ShieldCheck size={15}/><strong>{config?.credits??"—"}</strong><span>included credits</span></div></div>
 <div className="runner-grid"><div className="runner-controls"><label>Provider<select value={provider} onChange={e=>selectProvider(e.target.value as Provider)}>{Object.entries(labels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Model<select value={model} onChange={e=>setModel(e.target.value)}>{modelCatalog[provider].map(item=><option value={item.id} key={item.id}>{item.label}</option>)}</select><small className="model-sync">Auto-synced with {labels[provider]}</small></label><div className="access-tabs"><button className={mode==="byok"?"active":""} onClick={()=>setMode("byok")}><KeyRound size={14}/>Own API key</button><button className={mode==="included"?"active":""} onClick={()=>setMode("included")}><Bot size={14}/>Included credits</button></div>{mode==="byok"&&<div className="key-box">{connected?<div className="connected-key"><CheckCircle2 size={16}/><span>{labels[provider]} connected ·•••• {connected.keyLast4}</span><Button size="sm" variant="ghost" onClick={removeKey} disabled={busy}><Trash2 size={14}/></Button></div>:<><Input type="password" autoComplete="off" placeholder={`Paste your ${labels[provider]} API key`} value={apiKey} onChange={e=>setApiKey(e.target.value)}/><Button onClick={saveKey} disabled={busy||apiKey.length<16}><KeyRound size={14}/>Encrypt & connect</Button></>}</div>}{mode==="included"&&!config?.platform[provider]&&<p className="runner-notice">Included {labels[provider]} access is not funded yet. BYOK is available without platform markup.</p>}<Button className="glow h-11" onClick={run} disabled={busy||!prompt||!config}>{busy?<LoaderCircle className="runner-spinner" size={16}/>:<Play size={15}/>} {busy?"Running securely…":"Run compiled prompt"}</Button>{message&&<p className="runner-message" role="status">{message}</p>}
 {history.length>0&&<div className="run-history"><div><Clock3 size={13}/><span>RECENT RUNS</span><button onClick={()=>{setHistory([]);localStorage.removeItem(HISTORY_KEY)}}>Clear</button></div>{history.map(item=><button key={item.id} onClick={()=>openRun(item)}><span>{labels[item.provider]} · {item.model}</span><small>{new Date(item.createdAt).toLocaleString()}</small></button>)}</div>}</div>
 <div className="runner-output"><div className="runner-output-head"><span>MODEL RESPONSE</span>{usage&&<small>{usage.inputTokens} input · {usage.outputTokens} output tokens</small>}<Button size="sm" variant="ghost" disabled={!output} onClick={copyOutput}><Clipboard size={14}/>{copied?"Copied":"Copy"}</Button><Button size="sm" variant="ghost" disabled={!output} onClick={download}><Download size={14}/>Export</Button></div>{busy?<div className="runner-empty"><LoaderCircle className="runner-spinner" size={30}/><strong>{labels[provider]} is engineering your response</strong><span>Secure execution is in progress. Keep this tab open.</span></div>:output?<Markdown text={output}/>:<div className="runner-empty"><Bot size={30}/><strong>Ready for a real model run</strong><span>Connect a provider key or choose included access when available.</span></div>}{output&&!busy&&<div className="response-footer"><span><CheckCircle2 size={13}/> Secure run complete</span><Button size="sm" variant="ghost" onClick={run}><RotateCcw size={13}/>Run again</Button></div>}</div></div></section>
}