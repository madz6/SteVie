import { Children, cloneElement, isValidElement, useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowUpRight, LoaderCircle, X, AlertCircle, Inbox } from 'lucide-react';
import type { JobStatus } from './types';
import { safeUrl } from './api';

export const statusLabels:Record<JobStatus,string> = {saved:'Saved',preparing:'Preparing',ready:'Ready to review',applied:'Applied',interviewing:'Interviewing',offer:'Offer',rejected:'Rejected',archived:'Archived',unknown:'Status unknown'};
export const statusOptions = Object.entries(statusLabels) as [JobStatus,string][];
export function Status({value}:{value:JobStatus}) { return <span className={`status status-${value}`}><span/>{statusLabels[value] || value}</span>; }
export function Spinner({label='Loading'}:{label?:string}) { return <span className="busy-inline"><LoaderCircle size={16} className="spin"/>{label}</span>; }
export function ErrorMessage({error}:{error:string|null}) { return error ? <div className="error-message" role="alert"><AlertCircle size={17}/><span>{error}</span></div> : null; }
export function Empty({title,children,action}:{title:string;children?:ReactNode;action?:ReactNode}) { return <div className="empty-state"><span className="empty-icon"><Inbox size={25}/></span><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>; }
export function ExternalLink({url,children,className='text-link'}:{url:string;children:ReactNode;className?:string}) { const href=safeUrl(url); return href ? <a className={className} href={href} target="_blank" rel="noopener noreferrer">{children}<ArrowUpRight size={14}/></a> : null; }
export function dateLabel(value:string|null|undefined,full=false) { if (!value) return 'No date set'; const date = new Date(value.length===10 ? `${value}T12:00:00` : value); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('en-IE',{day:'numeric',month:'short', ...(full?{year:'numeric' as const}:{})}).format(date); }
export function daysUntil(value:string|null) { if (!value) return null; const parts=new Intl.DateTimeFormat('en-IE',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const part=(type:string)=>Number(parts.find(item=>item.type===type)?.value);const target=Date.parse(`${value.slice(0,10)}T00:00:00Z`);return Number.isFinite(target)?Math.round((target-Date.UTC(part('year'),part('month')-1,part('day')))/86400000):null; }
export function Deadline({value}:{value:string|null}) { const days=daysUntil(value); if (days===null) return <span className="muted">No deadline</span>; return <span className={days<=3?'deadline urgent':'deadline'}>{days<0 ? `Passed · ${dateLabel(value)}` : days===0 ? 'Due today' : days===1 ? 'Due tomorrow' : dateLabel(value)}</span>; }
export function Field({label,children,hint}:{label:string;children:ReactNode;hint?:string}) { const generated=useId();const child=Children.only(children);if(!isValidElement<{id?:string;'aria-describedby'?:string}>(child))return <label className="field"><span>{label}</span>{children}</label>;const id=child.props.id||generated;const description=[child.props['aria-describedby'],hint?`${id}-hint`:null].filter(Boolean).join(' ')||undefined;return <div className="field"><label htmlFor={id}>{label}</label>{cloneElement(child,{id,'aria-describedby':description})}{hint&&<small id={`${id}-hint`}>{hint}</small>}</div>; }
export function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
  const panel=useRef<HTMLDivElement>(null);
  const closeRef=useRef(onClose); closeRef.current=onClose;
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null;
    const before=document.body.style.overflow; document.body.style.overflow='hidden';
    panel.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    function key(event:KeyboardEvent) {
      if(event.key==='Escape') closeRef.current();
      if(event.key==='Tab') {
        const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey && document.activeElement===first) {event.preventDefault();last?.focus();}
        else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first?.focus();}
      }
    }
    document.addEventListener('keydown',key);
    return ()=>{document.removeEventListener('keydown',key);document.body.style.overflow=before;previous?.focus();};
  },[]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div ref={panel} className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true" aria-label={title}><header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={20}/></button></header>{children}</div></div>;
}

export function RichText({text}:{text:string}) {
  return <div className="rich-text">{text.split('\n').map((line,index)=>{
    if(line.startsWith('### '))return <h4 key={index}>{line.slice(4)}</h4>;
    if(line.startsWith('## '))return <h3 key={index}>{line.slice(3)}</h3>;
    if(line.startsWith('# '))return <h2 key={index}>{line.slice(2)}</h2>;
    if(/^[-*] /.test(line))return <div className="rich-bullet" key={index}><span>•</span><span>{line.slice(2).replace(/\*\*/g,'')}</span></div>;
    return line.trim()?<p key={index}>{line.replace(/\*\*/g,'')}</p>:<div className="rich-space" key={index}/>;
  })}</div>;
}
