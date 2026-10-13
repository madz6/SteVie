import {useState,type FormEvent} from 'react';
import {Plus,Search,Pencil} from 'lucide-react';
import {api} from './api';
import type {Bootstrap,Contact,Job} from './types';
import type {HiringSignal,OutreachDraft} from './networkingTypes';
import {dateLabel,Empty,ErrorMessage,ExternalLink,Field,Modal,Spinner} from './components';

export function PeopleView({data,openJob,onSaved}:{data:Bootstrap;openJob:(id:string)=>void;onSaved:(message:string)=>Promise<void>}){
  const [edit,setEdit]=useState<string|null>(null),[drafting,setDrafting]=useState<string|null>(null),[query,setQuery]=useState(''),[due,setDue]=useState(false);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin'}).format(new Date());
  const shown=data.contacts.filter(c=>`${c.name} ${c.company} ${c.role} ${c.signals?.map(s=>s.summary).join(' ')||''}`.toLowerCase().includes(query.toLowerCase())&&(!due||(c.followUp&&c.followUp<=today&&!['closed','done','complete','completed'].includes(c.status))));
  const contact=data.contacts.find(c=>c.id===drafting);
  return <><section className="page-heading"><div><div className="eyebrow">OPPORTUNITIES THROUGH PEOPLE</div><h1>People</h1><p>Keep the hiring signal, the conversation and your next step together.</p></div><button className="button primary" onClick={()=>setEdit('new')}><Plus size={17}/>Add a person</button></section>
    <section className="panel"><div className="list-toolbar"><label className="search-field"><Search size={17}/><input aria-label="Search people" placeholder="Name, company or hiring signal" value={query} onChange={e=>setQuery(e.target.value)}/></label><button className="button secondary" aria-pressed={due} onClick={()=>setDue(!due)}>{due?'Showing follow-ups due':'Show follow-ups due'}</button></div>
    {shown.length?<div className="people-grid">{shown.map(c=>{const active=data.tasks.find(t=>t.kind==='outreach'&&t.contactId===c.id&&['queued','running'].includes(t.status));return <article className="person-card" key={c.id}>
      <div className="person-heading"><span className="person-avatar">{c.name.split(' ').map(p=>p[0]).slice(0,2).join('')}</span><div><h3>{c.name}</h3><p>{[c.role,c.company].filter(Boolean).join(' · ')}</p></div><button className="icon-button" aria-label={`Edit ${c.name}`} onClick={()=>setEdit(c.id)}><Pencil size={16}/></button></div>
      {c.notes&&<p className="person-notes">{c.notes}</p>}
      {(c.signals||[]).map(s=><div className="people-signal" key={s.id}><strong>{s.status==='confirmed'?'Vacancy confirmed by you':s.status==='closed'?'Closed signal':'Opening unconfirmed'}</strong><p>{s.summary}</p><span>Observed {dateLabel(s.observedOn,true)} · </span><ExternalLink url={s.url}>View source</ExternalLink></div>)}
      {!!c.jobIds?.length&&<div className="people-roles"><span className="eyebrow">LINKED ROLES</span>{c.jobIds.map(id=>{const job=data.jobs.find(j=>j.id===id);return job?<button key={id} className="text-link" onClick={()=>openJob(id)}>{job.company} · {job.title}</button>:null;})}</div>}
      <div className="person-links">{c.profileUrl&&<ExternalLink url={c.profileUrl}>Profile</ExternalLink>}{c.email&&<span>{c.email}</span>}</div>
      <button className="button secondary" onClick={()=>setDrafting(c.id)}>{active?'View drafting progress':c.outreachDrafts?.length?`Review outreach (${c.outreachDrafts.length})`:'Prepare an approach'}</button>
      <footer><span className="contact-status">{c.status}</span><span>{c.followUp?`Follow up ${dateLabel(c.followUp)}`:'No follow-up set'}</span></footer>
    </article>;})}</div>:<Empty title={due?'No follow-ups due':'Save the person and the reason to reach out'}>Add a public hiring post, company announcement or a conversation you had. Sources are saved by you; automatic people discovery is not connected.</Empty>}</section>
    {edit&&<ContactForm contact={data.contacts.find(c=>c.id===edit)} jobs={data.jobs} onClose={()=>setEdit(null)} onSaved={async()=>{setEdit(null);await onSaved('Person and sources saved');}}/>}
    {contact&&<OutreachPanel key={contact.id} contact={contact} data={data} onClose={()=>setDrafting(null)} onSaved={onSaved}/>}
  </>;
}

function ContactForm({contact,jobs,onClose,onSaved}:{contact?:Contact;jobs:Job[];onClose:()=>void;onSaved:()=>Promise<void>}){
  const [signals,setSignals]=useState<HiringSignal[]>(contact?.signals||[]),[jobIds,setJobIds]=useState(contact?.jobIds||[]),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  function change(id:string,patch:Partial<HiringSignal>){setSignals(items=>items.map(s=>s.id===id?{...s,...patch}:s));}
  async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError(null);const fields=Object.fromEntries(new FormData(e.currentTarget).entries());try{await api(contact?`/contacts/${contact.id}`:'/contacts',contact?'PATCH':'POST',{...fields,followUp:fields.followUp||null,signals,jobIds});await onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Modal title={contact?`Edit ${contact.name}`:'Add a person'} onClose={onClose}><form className="modal-form" onSubmit={submit}>
    <Field label="Name"><input required name="name" defaultValue={contact?.name} maxLength={300}/></Field><div className="form-grid"><Field label="Company"><input name="company" defaultValue={contact?.company} maxLength={300}/></Field><Field label="Role"><input name="role" defaultValue={contact?.role} maxLength={300}/></Field></div>
    <Field label="Confirmed professional email (optional)"><input type="email" name="email" defaultValue={contact?.email}/></Field><Field label="Professional profile URL"><input type="url" name="profileUrl" defaultValue={contact?.profileUrl}/></Field>
    <Field label="Conversation and relationship context"><textarea name="notes" rows={3} defaultValue={contact?.notes} maxLength={12000} placeholder="How you know them, or why a cold approach makes sense. Don't assume a shared connection."/></Field>
    <fieldset className="people-fieldset"><legend>Hiring signals</legend><p className="muted">Keep the exact source and what it actually says. A funding announcement alone does not confirm a vacancy.</p>
      {signals.map((s,i)=><div className="people-signal-form" key={s.id}><Field label={`Signal ${i+1} source URL`}><input type="url" required value={s.url} onChange={e=>change(s.id,{url:e.target.value})}/></Field><Field label={`Signal ${i+1} observed date`}><input type="date" required value={s.observedOn} onChange={e=>change(s.id,{observedOn:e.target.value})}/></Field><Field label={`Signal ${i+1} summary`}><textarea required minLength={20} maxLength={4000} rows={3} value={s.summary} onChange={e=>change(s.id,{summary:e.target.value})}/></Field><Field label={`Signal ${i+1} status`}><select value={s.status} onChange={e=>change(s.id,{status:e.target.value as HiringSignal['status']})}><option value="unconfirmed">Opening unconfirmed</option><option value="confirmed">I confirmed an open vacancy</option><option value="closed">Closed / no longer relevant</option></select></Field><button className="button small secondary" type="button" onClick={()=>setSignals(items=>items.filter(item=>item.id!==s.id))}>Remove signal {i+1}</button></div>)}
      <button type="button" className="button secondary" disabled={signals.length>=20} onClick={()=>setSignals([...signals,{id:crypto.randomUUID(),url:'',observedOn:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin'}).format(new Date()),summary:'',status:'unconfirmed'}])}><Plus size={16}/>Add a signal</button>
    </fieldset>
    <Field label="Link a saved role (optional)"><select value="" onChange={e=>{if(e.target.value)setJobIds([...jobIds,e.target.value]);}} disabled={jobIds.length>=30}><option value="">Choose a saved opportunity</option>{jobs.filter(j=>!jobIds.includes(j.id)).map(j=><option key={j.id} value={j.id}>{j.company} · {j.title}</option>)}</select></Field>
    {jobIds.map(id=><div className="people-linked-row" key={id}><span>{jobs.find(j=>j.id===id)?.title||'Saved role'}</span><button type="button" className="button small secondary" aria-label={`Unlink ${jobs.find(j=>j.id===id)?.title||'role'}`} onClick={()=>setJobIds(jobIds.filter(item=>item!==id))}>Unlink</button></div>)}
    <div className="form-grid"><Field label="Conversation status"><select name="status" defaultValue={['new','contacted','replied','meeting','closed'].includes(contact?.status||'new')?contact?.status||'new':'new'}>{!['new','contacted','replied','meeting','closed'].includes(contact?.status||'new')&&<option value="new">New (replace legacy status)</option>}{['new','contacted','replied','meeting','closed'].map(s=><option key={s} value={s}>{s}</option>)}</select></Field><Field label="Follow-up date"><input type="date" name="followUp" defaultValue={contact?.followUp||''}/></Field></div>
    <ErrorMessage error={error}/><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy?<Spinner label="Saving"/>:'Save person'}</button></div>
  </form></Modal>;
}

function OutreachPanel({contact,data,onClose,onSaved}:{contact:Contact;data:Bootstrap;onClose:()=>void;onSaved:(s:string)=>Promise<void>}){
  const [provider,setProvider]=useState(data.settings.provider),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const task=data.tasks.find(t=>t.kind==='outreach'&&t.contactId===contact.id&&['queued','running'].includes(t.status));
  const failure=data.tasks.find(t=>t.kind==='outreach'&&t.contactId===contact.id&&t.status==='failed');
  const latestDraft=contact.outreachDrafts?.[0];
  const currentFailure=failure&&(!latestDraft||failure.createdAt>latestDraft.createdAt)?failure:null;
  async function generate(){setBusy(true);setError(null);try{await api(`/contacts/${contact.id}/outreach`,'POST',{provider});await onSaved('Outreach queued. It will appear here when ready.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Modal title={`Approach ${contact.name}`} onClose={onClose}><div className="modal-form"><p>Draft from the saved signals, linked roles, conversation notes and usable career evidence. These details and your profile go to the selected provider. Nothing is sent to this person.</p>
    <Field label="Drafting provider"><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="claude-code">Claude · signed-in plan</option><option value="codex">Codex · ChatGPT plan</option><option value="anthropic">Anthropic API</option><option value="openai">OpenAI API</option></select></Field>
    {!contact.signals?.some(s=>s.status!=='closed')&&<p>Add an open signal with its source, date and summary using Edit person first.</p>}
    <button className="button primary" disabled={busy||!!task||!contact.signals?.some(s=>s.status!=='closed')} onClick={()=>void generate()}>{busy||task?<Spinner label={task?.status==='running'?'Drafting':'Queued'}/>:'Prepare a draft'}</button><ErrorMessage error={error||(!task?currentFailure?.error||null:null)}/>
    {(contact.outreachDrafts||[]).map(d=><DraftEditor key={d.id} draft={d} evidence={data.evidence} contactId={contact.id} onSaved={onSaved}/>)}
  </div></Modal>;
}
function DraftEditor({draft,evidence,contactId,onSaved}:{draft:OutreachDraft;evidence:Bootstrap['evidence'];contactId:string;onSaved:(s:string)=>Promise<void>}){
  const [subject,setSubject]=useState(draft.subject),[body,setBody]=useState(draft.body),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState('');
  const dirty=subject!==draft.subject||body!==draft.body;
  async function save(reviewed=false){setBusy(true);setError(null);try{await api(`/contacts/${contactId}/outreach/${draft.id}`,'PATCH',{subject,body,reviewed});await onSaved(reviewed?'Marked reviewed. You decide when to send.':'Draft saved');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="people-draft"><h3>{draft.reviewedAt&&!draft.stale?'Reviewed by you':'Draft for review'}</h3><p className="muted">{draft.provider} · {dateLabel(draft.createdAt,true)}</p>{draft.stale&&<p role="status" className="error-text">Supporting context changed. Prepare a fresh draft before using this one.</p>}
    <Field label="Subject"><input value={subject} maxLength={200} onChange={e=>setSubject(e.target.value)}/></Field><Field label="Message"><textarea rows={9} value={body} maxLength={4000} onChange={e=>setBody(e.target.value)}/></Field>
    <details><summary>Checks and evidence references</summary><ul>{draft.flags.map((f,i)=><li key={i}>{f}</li>)}</ul><ul>{draft.evidenceIds.map(id=>{const item=evidence.find(e=>e.id===id);return <li key={id}>{item?`${item.text} (${item.status==='verified'?'Verified':'Stated by you'}; source: ${item.source})`:'Supporting evidence unavailable'}</li>;})}</ul></details>
    <div className="people-draft-actions"><button className="button secondary" disabled={busy||!dirty} onClick={()=>void save()}>Save edits</button><button className="button secondary" disabled={busy||draft.stale||dirty} onClick={()=>void save(true)}>Mark reviewed</button><button className="button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(`${subject}\n\n${body}`);setNotice('Copied. Review before sending.');}catch{setNotice('Select the message text above and copy it manually.');}}}>Copy text</button><button className="button secondary" onClick={()=>{const u=URL.createObjectURL(new Blob([`${subject}\n\n${body}`],{type:'text/plain'}));const a=document.createElement('a');a.href=u;a.download='outreach-draft.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}}>Download text</button></div>
    <button className="text-link" disabled={busy} onClick={async()=>{setBusy(true);setError(null);try{await api(`/contacts/${contactId}/outreach/${draft.id}`,'DELETE');await onSaved('Draft removed');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>Remove this draft</button><p role="status">{notice}</p><ErrorMessage error={error}/>
  </section>;
}
