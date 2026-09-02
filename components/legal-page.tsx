import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Command, ExternalLink, ShieldCheck } from "lucide-react";

type LegalSection={title:string;content:ReactNode};
type Props={eyebrow:string;title:string;summary:string;sections:LegalSection[]};

export function LegalPage({eyebrow,title,summary,sections}:Props){
 return <main className="legal-shell"><div className="noise"/><div className="legal-aurora"/>
  <nav className="legal-nav"><Link href="/" className="legal-brand"><span className="logo"><Command size={17}/></span><strong>Instruxa</strong><small>PRIVATE BETA</small></Link><Link href="/"><ArrowLeft size={14}/>Back to workspace</Link></nav>
  <article className="legal-document"><header><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{summary}</p><div className="legal-meta"><ShieldCheck size={14}/><span>Last updated September 2, 2026</span></div></header>
   <aside><strong>Private-beta notice</strong><p>This page documents Instruxa&apos;s current product practices. It must receive qualified legal review before public paid launch.</p></aside>
   <div className="legal-sections">{sections.map(section=><section key={section.title}><h2>{section.title}</h2><div>{section.content}</div></section>)}</div>
  </article>
  <footer className="legal-footer"><span>© 2026 Instruxa</span><div><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/security">Security</Link><a href="https://github.com/veerendrakalyanbabu-VKB/Instruxa">GitHub <ExternalLink size={11}/></a></div></footer>
 </main>
}
