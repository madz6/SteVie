import { Children, useState, type ReactNode } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { api } from './api';
import { trackFor, trackLabels, type JobTrack } from './jobTracks';
import type { Bootstrap, Task } from './types';
import { dateLabel, daysUntil, ErrorMessage, Spinner } from './components';
import { canRecover, useInbox } from './Recovery';

type Destination='applications'|'practice'|'people'|'inbox'|'data'|'connections';
export function MissionControl({data,openJob,navigate,addJob,refresh}:{data:Bootstrap;openJob:(id:string,documentId?:string)=>void;navigate:(view:Destination)=>void;addJob:()=>void;refresh:()=>Promise<void>}) {
  const {snapshot,error:inboxError,loading}=useInbox();
  const [retrying,setRetrying]=useState(''),[error,setError]=useState<string|null>(null);
  const [track,setTrack]=useState<JobTrack|'all'>('career');
  const active=data.jobs.filter(job=>(track==='all'||trackFor(job)===track)&&!['rejected','archived','offer'].includes(job.status));
  const reviewDocs=data.documents.filter(doc=>doc.status!=='approved'&&active.some(job=>job.id===doc.jobId));
  const latestMail=new Map<string,number>();
  for(const message of snapshot?.messages||[])if(message.jobId)latestMail.set(message.jobId,Math.max(latestMail.get(message.jobId)||0,Date.parse(message.receivedAt)));
  const uncertain=active.filter(job=>job.needsReview&&!job.source.includes('uncertain identity')).sort((a,b)=>(latestMail.get(b.id)||Date.parse(b.updatedAt))-(latestMail.get(a.id)||Date.parse(a.updatedAt)));
  const overdue=active.filter(job=>!job.needsReview&&job.deadline&&(daysUntil(job.deadline)??0)<0).sort((a,b)=>a.deadline!.localeCompare(b.deadline!));
  const upcoming=active.filter(job=>!job.needsReview&&job.deadline&&(daysUntil(job.deadline)??-1)>=0).sort((a,b)=>a.deadline!.localeCompare(b.deadline!));
  const followups=data.contacts.filter(contact=>contact.followUp&&new Date(contact.followUp).valueOf()<=Date.now()&&!['closed','done','complete','completed'].includes(contact.status.toLowerCase()));
  const running=data.tasks.filter(task=>task.status==='queued'||task.status==='running'),failed=data.tasks.filter(task=>task.status==='failed');
  const approved=data.documents.filter(doc=>doc.status==='approved'&&active.some(job=>job.id===doc.jobId));
  const recoverable=snapshot?.candidates.filter(canRecover)||[];
  const decisionCount=reviewDocs.length+uncertain.length+overdue.length;
  async function retry(task:Task){setRetrying(task.id);setError(null);try{await api(`/tasks/${task.id}/retry`,'POST');await refresh();}catch(e){setError((e as Error).message);}finally{setRetrying('');}}
  const taskTitle=(task:Task)=>`${task.kind==='application'?'Application preparation':task.kind==='practice'?'Practice feedback':'Role discovery'}${task.jobId?` · ${data.jobs.find(job=>job.id===task.jobId)?.company||'Application'}`:''}`;
  return <><section className="page-heading"><div><div className="eyebrow">YOUR DAILY COMMAND VIEW</div><h1>Your next decisions, {data.profile.name.split(' ')[0]}.</h1><p>Work to review, actions you can take, and the evidence behind your record.</p></div><button className="button primary" onClick={addJob}><Plus size={17}/>Add a role</button></section>
    <div className="pipeline-tabs" role="group" aria-label="Daily pipeline">{(['career','income','unclassified','all'] as const).map(value=><button key={value} className="button secondary" aria-pressed={track===value} onClick={()=>setTrack(value)}>{value==='all'?'All roles':trackLabels[value]}</button>)}</div>
    <nav className="mc-counts" aria-label="Jump to work state">{[['decisions','Needs decision',decisionCount],['ready','Ready to act',approved.length+followups.length+recoverable.length],['running','Running',running.length],['blocked','Blocked',failed.length]].map(([id,label,count])=><a key={id} href={`#mc-${id}`}><strong>{count}</strong><span>{label}</span></a>)}</nav>
    <section className="panel mc-coverage"><div><div className="eyebrow">INBOX COVERAGE</div><h2>{loading&&!snapshot?'Checking saved evidence':snapshot?.coverage?`${snapshot.coverage.messages} messages checked`:'Coverage unknown'}</h2><p>{snapshot?.coverage?`${snapshot.coverage.complete?'Recorded query complete':'Partial coverage'} · Last checked ${dateLabel(snapshot.coverage.checkedAt,true)}. ${snapshot.coverage.detail}`:'Your application list may be incomplete. Review the saved correspondence and its coverage before relying on the record.'}</p>{inboxError&&<p className="error-text">Inbox evidence could not be loaded. Open recovery to retry.</p>}</div><button className="button secondary" onClick={()=>navigate('inbox')}>Review inbox evidence<ArrowRight size={16}/></button></section>
    <ErrorMessage error={error}/><div className="mc-layout"><div className="mc-main">
    <WorkSection id="decisions" title="Needs decision" count={decisionCount} empty="No recorded decisions waiting. Coverage gaps may still hide work.">
      {reviewDocs.map(doc=><WorkRow key={doc.id} title={doc.title} detail={`${data.jobs.find(job=>job.id===doc.jobId)?.company||'Application'} · ${doc.flags.length?`${doc.flags.length} item(s) to check`:'Document review needed'}`} action="Review document" onClick={()=>openJob(doc.jobId,doc.id)}/>)}
      {uncertain.map(job=><WorkRow key={job.id} title={`Verify ${job.company} · ${job.title}`} detail={`Imported details need review${job.deadline?` · Recorded deadline ${dateLabel(job.deadline,true)}`:''}. Source: ${job.source||'Not recorded'}.`} action="Review application" onClick={()=>openJob(job.id)}/>)}
      {overdue.map(job=><WorkRow key={job.id} title={`Past deadline · ${job.company}`} detail={`${job.title} · ${dateLabel(job.deadline,true)}. Check the outcome or update the record.`} action="Check outcome" onClick={()=>openJob(job.id)}/>)}
    </WorkSection>
    <WorkSection id="ready" title="Ready to act" count={approved.length+followups.length+recoverable.length} empty="No ready actions recorded. Add a role, recover inbox evidence, or start a practice session.">
      {approved.map(doc=><WorkRow key={doc.id} title={doc.title} detail="Document approved by you. Review its application before external use." action="Review document" onClick={()=>openJob(doc.jobId,doc.id)}/>)}
      {followups.map(contact=><WorkRow key={contact.id} title={`Follow up with ${contact.name}`} detail={`${contact.company||'Contact'} · Due ${dateLabel(contact.followUp,true)}`} action="Open people" onClick={()=>navigate('people')}/>)}
      {recoverable.length>0&&<WorkRow title={`${recoverable.length} application record(s) can be recovered`} detail="Clear historical inbox evidence is available for your review." action="Review recovery" onClick={()=>navigate('inbox')}/>}
    </WorkSection>
    <WorkSection id="running" title="Running" count={running.length} empty="No preparation tasks are queued or running.">{running.map(task=><WorkRow key={task.id} title={taskTitle(task)} detail={`${task.status==='queued'?'Queued':'Running'} · Created ${dateLabel(task.createdAt,true)}`} action={task.jobId?'Open application':'Open practice'} onClick={()=>task.jobId?openJob(task.jobId):navigate('practice')}/>)}</WorkSection>
    <WorkSection id="blocked" title="Blocked" count={failed.length} empty="No failed preparation tasks recorded.">{failed.map(task=><div className="mc-work-row" key={task.id}><div><h3>{taskTitle(task)}</h3><p className="error-text">{task.error||'Preparation did not finish.'}</p><p>Created {dateLabel(task.createdAt,true)}</p></div><button className="button secondary" disabled={!!retrying} onClick={()=>void retry(task)}>{retrying===task.id?<Spinner label="Retrying"/>:'Retry task'}</button></div>)}</WorkSection>
    </div><aside className="mc-aside"><section className="panel mc-section"><h2>Upcoming deadlines</h2><p>Reviewed records only. Past dates are shown under Needs decision.</p>{upcoming.length?upcoming.map(job=><WorkRow key={job.id} title={job.company} detail={`${job.title} · ${dateLabel(job.deadline,true)}`} action="Open role" onClick={()=>openJob(job.id)}/>):<p className="mc-empty">No future deadline is recorded on a reviewed application.</p>}</section><section className="panel mc-section"><h2>Keep your record portable</h2><p>Export your workspace or preview an import before changing your records.</p><button className="button secondary" onClick={()=>navigate('data')}>Import & export<ArrowRight size={16}/></button></section><section className="panel mc-section"><h2>Prepare for the next conversation</h2><p>Resume a drill or practise with your case material.</p><button className="button secondary" onClick={()=>navigate('practice')}>Open practice<ArrowRight size={16}/></button></section></aside></div>
  </>;
}
function WorkSection({id,title,count,empty,children}:{id:string;title:string;count:number;empty:string;children:ReactNode}){const [expanded,setExpanded]=useState(false);const rows=Children.toArray(children);return <section id={`mc-${id}`} className="panel mc-section" tabIndex={-1}><div className="mc-row-heading"><h2>{title}</h2><span className="mc-badge">{count}</span></div>{count?(expanded?rows:rows.slice(0,6)):<p className="mc-empty">{empty}</p>}{rows.length>6&&<button className="button secondary" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?'Show fewer':`Show ${rows.length-6} more`}</button>}</section>;}
function WorkRow({title,detail,action,onClick}:{title:string;detail:string;action:string;onClick:()=>void}){return <div className="mc-work-row"><div><h3>{title}</h3><p>{detail}</p></div><button className="button secondary" onClick={onClick}>{action}<ArrowRight size={15}/></button></div>;}

