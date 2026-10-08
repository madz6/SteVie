import { useState } from 'react';
import { PracticeSession } from './PracticeSession';
import { ArrowRight, BarChart3, Brain, Calculator, Check, ChevronRight, MessageSquare, Play } from 'lucide-react';
import { api } from './api';
import type { Bootstrap, Practice } from './types';
import { dateLabel, Empty, ErrorMessage, Field, Spinner } from './components';
const kinds=[
  {id:'behavioural',title:'Interview stories',description:'Make your experience clear, relevant and concise.',icon:MessageSquare},
  {id:'case',title:'Case interviews',description:'Structure the problem and defend your reasoning.',icon:Brain},
  {id:'numerical',title:'Numerical practice',description:'Work with the right data and check your calculations.',icon:Calculator},
  {id:'market-sizing',title:'Market sizing',description:'Build a range from explicit assumptions.',icon:BarChart3},
  {id:'chart-reasoning',title:'Chart reasoning',description:'Separate patterns from causal claims.',icon:BarChart3},
  {id:'product',title:'Product thinking',description:'Choose a user problem, metric and trade-off.',icon:Play},
  {id:'mental-maths',title:'Mental maths',description:'Estimate, calculate and check under time pressure.',icon:Calculator},
];

export function PracticeView({data,onSaved}:{data:Bootstrap;onSaved:(message:string)=>Promise<void>}) {
  const [kind,setKind]=useState('behavioural'),[jobId,setJobId]=useState(''),[knowledgeId,setKnowledgeId]=useState(''),[selected,setSelected]=useState<string|null>(data.practice[0]?.id||null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  const current=data.practice.find(item=>item.id===selected);
  async function start(){setBusy(true);setError(null);try{const session=await api<Practice>('/practice','POST',{kind,...(jobId?{jobId}:{}),...(kind==='case'&&knowledgeId?{knowledgeId}:{})});await onSaved('Practice session started');setSelected(session.id);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <><section className="page-heading"><div><div className="eyebrow">PREPARATION THAT BUILDS</div><h1>Practice</h1><p>Work through a question in stages. Get feedback on the reasoning, not only the final answer.</p></div></section><div className="practice-layout"><div>
    <details className="panel practice-setup" open={!current}><summary>{current?'Start another session':'Choose your first drill'}</summary><section className="practice-start"><div className="panel-heading"><div><h2>Choose a drill</h2><p>Use your own case material when it is imported and marked reviewed.</p></div></div><div className="practice-kinds">{kinds.map(({id,title,description,icon:Icon})=><button className={`practice-kind ${kind===id?'selected':''}`} key={id} onClick={()=>{setKind(id);if(id!=='case')setKnowledgeId('');}} aria-pressed={kind===id}><Icon size={21} strokeWidth={1.7}/><span><strong>{title}</strong><small>{description}</small></span>{kind===id&&<Check size={17}/>}</button>)}</div><div className="practice-start-footer"><Field label="Prepare for a specific application"><select value={jobId} onChange={e=>setJobId(e.target.value)}><option value="">General practice</option>{data.jobs.filter(job=>!['rejected','archived'].includes(job.status)).map(job=><option key={job.id} value={job.id}>{job.company} · {job.title}</option>)}</select></Field>{kind==='case'&&<Field label="Use your case material" hint="A saved link has no readable case text until imported."><select value={knowledgeId} onChange={e=>setKnowledgeId(e.target.value)}><option value="">Synthetic training case</option>{data.knowledge.filter(item=>item.kind==='case'&&item.status==='reviewed'&&item.content.trim()).map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></Field>}<button className="button primary" onClick={()=>void start()} disabled={busy}>{busy?<Spinner label="Starting"/>:<>Start a session<ArrowRight size={16}/></>}</button></div><ErrorMessage error={error}/></section></details>
    {current?<PracticeSession key={current.id} session={current} provider={data.settings.provider} onSaved={onSaved}/>:<section className="panel practice-empty"><Empty title="Give your first answer">Start a session above. Your question, answer and feedback will stay together here.</Empty></section>}
    </div><aside className="panel practice-history"><div className="panel-heading"><h2>Your sessions</h2><span className="count-label">{data.practice.length}</span></div>{data.practice.length?data.practice.map(session=><button key={session.id} className={`session-row ${session.id===selected?'active':''}`} onClick={()=>setSelected(session.id)}><div><span className="eyebrow">{session.kind}</span><strong>{session.title}</strong><small>{dateLabel(session.createdAt)} · {session.feedback?'Feedback ready':session.answer?'Answer submitted':'Ready to practise'}</small></div><ChevronRight size={17}/></button>):<div className="compact-empty">Your practice history will appear here.</div>}</aside></div></>;
}

