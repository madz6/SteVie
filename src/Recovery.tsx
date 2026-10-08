import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { api } from './api';
import { dateLabel, Empty, ErrorMessage, ExternalLink, Field, Modal, Spinner } from './components';
import type { Job } from './types';

export interface InboxMessage { id:string; providerId:string; threadId:string; subject:string; sender:string; snippet:string; receivedAt:string; url:string; kind:string; company:string; role:string; confidence:'high'|'medium'|'low'; reason:string; jobId:string|null }
export interface InboxCandidate { id:string; company:string; role:string; eventKind:string; lastSeen:string; messageIds:string[]; confidence:'high'|'medium'|'low'; jobId:string|null; reason:string }
export interface InboxCoverage { checkedAt:string; query:string; pages:number; messages:number; oldest:string; newest:string; complete:boolean; detail:string }
export interface InboxSnapshot { messages:InboxMessage[]; candidates:InboxCandidate[]; coverage:InboxCoverage|null }
export function useInbox() {
  const [snapshot,setSnapshot]=useState<InboxSnapshot|null>(null),[error,setError]=useState<string|null>(null),[loading,setLoading]=useState(true);
  const reload=useCallback(async()=>{setLoading(true);setError(null);try{setSnapshot(await api<InboxSnapshot>('/inbox'));}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[]);
  useEffect(()=>{void reload();},[reload]);
  return {snapshot,error,loading,reload};
}
export const canRecover=(candidate:InboxCandidate)=>candidate.confidence==='high'&&!candidate.jobId&&['receipt','interview','assessment','rejection','offer'].includes(candidate.eventKind);
const eventLabels:Record<string,string>={receipt:'Application acknowledgement',interview:'Interview message',assessment:'Assessment message',rejection:'Rejection message',offer:'Offer message',recommendation:'Recommended role',other:'Other correspondence'};

export function CoverageSummary({coverage}:{coverage:InboxCoverage|null}) {
  if(!coverage)return <p>No coverage record is available. The extent of mailbox history checked is unknown.</p>;
  return <div className="recovery-coverage"><div className="mc-row-heading"><h2>Evidence coverage</h2><span className="mc-badge">{coverage.complete?'Recorded query complete':'Partial coverage'}</span></div><p>{coverage.detail}</p><dl className="mc-facts"><div><dt>Last checked</dt><dd>{dateLabel(coverage.checkedAt,true)}</dd></div><div><dt>Messages checked</dt><dd>{coverage.messages}</dd></div><div><dt>Pages checked</dt><dd>{coverage.pages}</dd></div><div><dt>Observed date range</dt><dd>{coverage.oldest?dateLabel(coverage.oldest,true):'Unknown'} – {coverage.newest?dateLabel(coverage.newest,true):'Unknown'}</dd></div></dl><details><summary>View the recorded query</summary><p className="recovery-query">{coverage.query||'No query recorded'}</p></details></div>;
}

export function Recovery({jobs,onSaved,openJob}:{jobs:Job[];onSaved:(message:string)=>Promise<void>;openJob:(id:string)=>void}) {
  const {snapshot,error,loading,reload}=useInbox();
  const [resolving,setResolving]=useState<InboxCandidate|null>(null);
  const [query,setQuery]=useState(''),[filter,setFilter]=useState('recoverable'),[selected,setSelected]=useState<string[]>([]),[busy,setBusy]=useState(false),[actionError,setActionError]=useState<string|null>(null),[result,setResult]=useState('');
  const candidates=snapshot?.candidates||[];
  const shown=candidates.filter(item=>(filter==='all'||filter==='linked'&&!!item.jobId||filter==='recoverable'&&canRecover(item)||filter==='unlinked'&&!item.jobId||filter==='review'&&!item.jobId&&!canRecover(item))&&`${item.company} ${item.role} ${item.eventKind}`.toLowerCase().includes(query.toLowerCase()));
  const clearReceipts=shown.filter(item=>canRecover(item)&&item.eventKind==='receipt');
  const selectedIds=selected.filter(id=>candidates.some(item=>item.id===id&&canRecover(item)));
  async function recover(ids:string[]) {
    if(!ids.length)return;setBusy(true);setActionError(null);setResult('');
    try{const outcome=await api<{created:number;linked:number;skipped:number}>('/inbox/recover','POST',{candidateIds:ids});const message=`Recovery complete: ${outcome.created} created, ${outcome.linked} linked, ${outcome.skipped} skipped.`;setResult(message);setSelected([]);await reload();await onSaved(message);}catch(e){setActionError((e as Error).message);}finally{setBusy(false);}
  }
  return <><section className="page-heading"><div><div className="eyebrow">REBUILD YOUR RECORD</div><h1>Inbox recovery</h1><p>Review saved correspondence and recover applications with their evidence.</p></div><button className="button secondary" disabled={loading||busy} onClick={()=>void reload()}><RefreshCw size={17}/>Refresh evidence</button></section>
    <section className="panel mc-notice"><h2>Historical observations, ready to review</h2><p>Messages show what happened at the time. An old interview invitation is not a current booking. Recovery creates or links records; it does not overwrite an existing application's stage.</p><p>This view reads saved evidence. Refreshing it does not start a live mailbox search.</p></section>
    <ErrorMessage error={error}/>{loading&&!snapshot&&<Spinner label="Loading inbox evidence"/>}
    {snapshot&&<><section className="panel mc-section"><CoverageSummary coverage={snapshot.coverage}/></section>
    <section className="panel mc-section"><div className="mc-row-heading"><div><h2>Review the evidence</h2><p>{candidates.length} grouped candidate{candidates.length===1?'':'s'} · {snapshot.messages.length} saved messages</p></div></div>
      <div className="recovery-filters"><Field label="Find a company or role"><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search saved evidence"/></Field><Field label="Show"><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="recoverable">Clear recovery candidates</option><option value="unlinked">All unlinked evidence</option><option value="review">Needs interpretation</option><option value="linked">Linked to applications</option><option value="all">All evidence</option></select></Field></div>
      <div className="recovery-batch"><button className="button secondary" disabled={busy||!clearReceipts.length} onClick={()=>setSelected(Array.from(new Set([...selected,...clearReceipts.map(item=>item.id)])))}>Select clear receipts in this view ({clearReceipts.length})</button>{selectedIds.length>0&&<><button className="button primary" disabled={busy} onClick={()=>void recover(selectedIds)}>{busy?<Spinner label="Recovering"/>:`Recover selected (${selectedIds.length})`}</button><button className="text-button" disabled={busy} onClick={()=>setSelected([])}>Clear selection</button></>}</div>
      <ErrorMessage error={actionError}/>{result&&<p className="success-message" role="status"><Check size={17}/>{result}</p>}<p className="mc-result-count" role="status">{shown.length} candidate{shown.length===1?'':'s'} shown</p>
      {shown.length?<div className="recovery-list">{shown.map(candidate=>{const messages=snapshot.messages.filter(message=>candidate.messageIds.includes(message.id));return <article className="recovery-candidate" key={candidate.id}><div className="mc-row-heading"><div><h3>{candidate.company||'Company not identified'}</h3><p>{candidate.role||'Role not identified'}</p></div><span className="mc-badge">{candidate.jobId?'Linked':candidate.confidence==='high'?'Clear evidence':'Needs interpretation'}</span></div><p><strong>{eventLabels[candidate.eventKind]||candidate.eventKind}</strong> · Last observed {dateLabel(candidate.lastSeen,true)}</p><p>{candidate.reason}</p><details><summary>View source evidence ({messages.length})</summary>{messages.length?messages.map(message=><div className="recovery-message" key={message.id}><h4>{message.subject||'Untitled message'}</h4><p>{message.sender} · {dateLabel(message.receivedAt,true)}</p><blockquote>{message.snippet||'No message excerpt was saved.'}</blockquote><p>{message.reason}</p>{message.url?<ExternalLink url={message.url}>Open original message</ExternalLink>:<p>Original-message link unavailable.</p>}</div>):<p>Source messages are missing from this snapshot. Review the coverage record before relying on this candidate.</p>}</details><div className="recovery-actions">{candidate.jobId?<button className="button secondary" onClick={()=>openJob(candidate.jobId!)}>Open application</button>:canRecover(candidate)?<><label className="recovery-select"><input type="checkbox" disabled={busy} checked={selectedIds.includes(candidate.id)} onChange={e=>setSelected(current=>e.target.checked?[...current,candidate.id]:current.filter(id=>id!==candidate.id))}/><span>Select {candidate.company||'this candidate'}</span></label><button className="button secondary" disabled={busy} onClick={()=>void recover([candidate.id])}>Recover application</button></>:<p>Review this evidence before creating an application. A recommendation or uncertain match is not proof of an application.</p>}{!candidate.jobId&&<button className="button secondary" disabled={busy} onClick={()=>setResolving(candidate)}>Resolve identity</button>}</div></article>;})}</div>:<Empty title={candidates.length?'No candidates match this view':'No inbox evidence saved'}>{candidates.length?'Try a different filter or search.':'Saved inbox evidence will appear here when it has been imported. No mailbox coverage is assumed.'}</Empty>}
    </section></>}
    {resolving&&<ResolveEvidence candidate={resolving} jobs={jobs} onClose={()=>setResolving(null)} onSaved={async()=>{setResolving(null);await reload();await onSaved('Source evidence linked. Application stage preserved.');}}/>}
  </>;
}

function ResolveEvidence({candidate,jobs,onClose,onSaved}:{candidate:InboxCandidate;jobs:Job[];onClose:()=>void;onSaved:()=>Promise<void>}) {
  const [mode,setMode]=useState(jobs.length?'existing':'new'),[jobId,setJobId]=useState(''),[company,setCompany]=useState(candidate.company),[title,setTitle]=useState(candidate.role),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false);
  async function submit(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError(null);
    try{await api('/inbox/link','POST',{messageIds:candidate.messageIds,...(mode==='existing'?{jobId}:{company,title})});await onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <Modal title="Resolve application identity" onClose={()=>{if(!busy)onClose();}}><form onSubmit={submit} className="form-stack">
    <p>Link {candidate.messageIds.length} saved message{candidate.messageIds.length===1?'':'s'} after checking the source evidence. Linking keeps an existing application's stage. A new record starts with status unknown.</p>
    <Field label="Where should this evidence go?"><select value={mode} disabled={busy} onChange={e=>setMode(e.target.value)}><option value="existing" disabled={!jobs.length}>An existing application</option><option value="new">A new record with confirmed identity</option></select></Field>
    {mode==='existing'?<Field label="Application"><select required value={jobId} disabled={busy} onChange={e=>setJobId(e.target.value)}><option value="">Choose an application</option>{[...jobs].sort((a,b)=>a.company.localeCompare(b.company)||a.title.localeCompare(b.title)).map(job=><option key={job.id} value={job.id}>{job.company} · {job.title} · {job.status}</option>)}</select></Field>:<><Field label="Company"><input required maxLength={160} value={company} disabled={busy} onChange={e=>setCompany(e.target.value)}/></Field><Field label="Exact role"><input required maxLength={200} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)}/></Field></>}
    <ErrorMessage error={error}/><button className="button primary" disabled={busy}>{busy?'Linking evidence…':'Save evidence link'}</button>
  </form></Modal>;
}
