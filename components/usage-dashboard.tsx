"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Bot, CheckCircle2, Clock3, Gauge, KeyRound, RefreshCw, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type ProviderRow={provider:string;runs:number;successfulRuns:number;inputTokens:number;outputTokens:number;avgLatencyMs:number};
type ModelRow={provider:string;model:string;runs:number;inputTokens:number;outputTokens:number};
type QualityRow={provider:string;model:string;overall:number;createdAt:string};
type WinnerRow={provider:string;model:string;wins:number};
type Analytics={
 days:number;
 summary:{totalRuns:number;successfulRuns:number;failedRuns:number;successRate:number;inputTokens:number;outputTokens:number;avgLatencyMs:number;byokRuns:number;includedRuns:number;averageQuality:number;credits:number};
 providers:ProviderRow[];models:ModelRow[];quality:QualityRow[];winners:WinnerRow[];
};
const labels:Record<string,string>={openai:"OpenAI",anthropic:"Claude",gemini:"Gemini"};
const colors:Record<string,string>={openai:"#34d399",anthropic:"#fb923c",gemini:"#a78bfa"};
const compact=(value:number)=>new Intl.NumberFormat("en",{notation:"compact",maximumFractionDigits:1}).format(value||0);
async function fetchAnalytics(days:number){
 const response=await fetch(`/api/ai/analytics?days=${days}`,{headers:{"content-type":"application/json"}});
 const data=await response.json() as Analytics&{error?:string};if(!response.ok)throw new Error(data.error||"Analytics request failed");return data;
}

export function UsageDashboard(){
 const [days,setDays]=useState(30),[data,setData]=useState<Analytics|null>(null),[loading,setLoading]=useState(true),[message,setMessage]=useState("");
 const load=useCallback(async(nextDays:number)=>{setLoading(true);setMessage("");try{setData(await fetchAnalytics(nextDays))}catch(error){const text=error instanceof Error?error.message:"Analytics unavailable";if(!text.toLowerCase().includes("authentication"))setMessage(text);else setData(null)}finally{setLoading(false)}},[]);
 useEffect(()=>{let active=true;fetchAnalytics(days).then(next=>{if(active)setData(next)}).catch(error=>{if(!active)return;const text=error instanceof Error?error.message:"Analytics unavailable";if(!text.toLowerCase().includes("authentication"))setMessage(text);else setData(null)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[days]);
 useEffect(()=>{const sync=()=>void load(days);window.addEventListener("instruxa-auth-changed",sync);return()=>window.removeEventListener("instruxa-auth-changed",sync)},[days,load]);
 const maxRuns=useMemo(()=>Math.max(1,...(data?.providers.map(row=>Number(row.runs))??[1])),[data]);
 const maxQuality=useMemo(()=>Math.max(1,...(data?.quality.map(row=>row.overall)??[1])),[data]);
 const stats=data?.summary;
 return <section id="intelligence" className="intel-section">
  <div className="intel-head"><div><span className="eyebrow">USAGE & INTELLIGENCE</span><h2>See how your AI system performs.</h2><p>Private, account-scoped visibility into execution volume, reliability, quality, latency, access mode, and model behavior.</p></div><div className="intel-actions"><div className="period-tabs">{[7,30,90].map(value=><button className={days===value?"active":""} key={value} onClick={()=>{setLoading(true);setDays(value)}}>{value}D</button>)}</div><Button size="sm" variant="outline" onClick={()=>load(days)} disabled={loading}><RefreshCw className={loading?"runner-spinner":""} size={13}/>Refresh</Button></div></div>
  {!data&&!loading?<div className="intel-locked"><ShieldCheck size={25}/><strong>Sign in to unlock private analytics</strong><span>Your metrics are calculated only from your authenticated Instruxa activity.</span>{message&&<small>{message}</small>}</div>:<>
   <div className="intel-kpis">
    <article><Activity/><span>Total runs</span><strong>{compact(stats?.totalRuns??0)}</strong><small>{days}-day execution volume</small></article>
    <article><CheckCircle2/><span>Success rate</span><strong>{stats?.successRate??0}%</strong><small>{stats?.failedRuns??0} failed runs</small></article>
    <article><Sparkles/><span>Average quality</span><strong>{stats?.averageQuality??0}</strong><small>Explainable score / 100</small></article>
    <article><Clock3/><span>Average latency</span><strong>{compact(stats?.avgLatencyMs??0)}<i> ms</i></strong><small>Successful executions</small></article>
    <article><Zap/><span>Total tokens</span><strong>{compact((stats?.inputTokens??0)+(stats?.outputTokens??0))}</strong><small>{compact(stats?.inputTokens??0)} in · {compact(stats?.outputTokens??0)} out</small></article>
    <article><Gauge/><span>Credits remaining</span><strong>{stats?.credits??"—"}</strong><small>Included-access balance</small></article>
   </div>
   <div className="intel-grid">
    <article className="intel-panel"><header><div><BarChart3 size={15}/><strong>Provider distribution</strong></div><span>{stats?.byokRuns??0} BYOK · {stats?.includedRuns??0} included</span></header><div className="provider-bars">{data?.providers.length?data.providers.map(row=><div key={row.provider}><div><span><i style={{background:colors[row.provider]}}/>{labels[row.provider]??row.provider}</span><b>{row.runs} runs</b></div><div className="bar-track"><i style={{width:`${Math.max(4,Number(row.runs)/maxRuns*100)}%`,background:colors[row.provider]}}/></div><small>{row.successfulRuns}/{row.runs} succeeded · {compact(row.avgLatencyMs)} ms avg</small></div>):<p className="intel-empty">Run a model to populate provider analytics.</p>}</div></article>
    <article className="intel-panel"><header><div><Sparkles size={15}/><strong>Quality trajectory</strong></div><span>Last {data?.quality.length??0} evaluated runs</span></header>{data?.quality.length?<><div className="quality-chart">{data.quality.map((row,index)=><i key={`${row.createdAt}-${index}`} title={`${labels[row.provider]??row.provider}: ${row.overall}/100`} style={{height:`${Math.max(8,row.overall/maxQuality*100)}%`,background:colors[row.provider]}}/>)}</div><div className="quality-legend"><span>0</span><strong>Quality trend</strong><span>100</span></div></>:<p className="intel-empty">Quality history appears after evaluated responses complete.</p>}</article>
   </div>
   <div className="intel-grid lower">
    <article className="intel-panel model-table"><header><div><Bot size={15}/><strong>Model intelligence</strong></div><span>Top models by usage</span></header><div className="table-head"><span>Model</span><span>Runs</span><span>Tokens</span></div>{data?.models.length?data.models.map(row=><div className="table-row" key={`${row.provider}-${row.model}`}><span><i style={{background:colors[row.provider]}}/>{row.model}<small>{labels[row.provider]??row.provider}</small></span><b>{row.runs}</b><b>{compact(Number(row.inputTokens)+Number(row.outputTokens))}</b></div>):<p className="intel-empty">No model usage in this period.</p>}</article>
    <article className="intel-panel winner-panel"><header><div><KeyRound size={15}/><strong>Winning models</strong></div><span>Response Lab selections</span></header>{data?.winners.length?data.winners.map((row,index)=><div className="winner-row" key={`${row.provider}-${row.model}`}><b>#{index+1}</b><span>{row.model}<small>{labels[row.provider]??row.provider}</small></span><strong>{row.wins} win{Number(row.wins)===1?"":"s"}</strong></div>):<p className="intel-empty">Compare models and mark a winner to build this leaderboard.</p>}</article>
   </div>
  </>}
 </section>
}
