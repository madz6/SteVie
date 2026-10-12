import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Save, Send } from 'lucide-react';
import { api } from './api';
import { dateLabel, ErrorMessage, ExternalLink, Field, RichText, Spinner } from './components';
import type { Practice } from './types';

type Stage='clarify'|'structure'|'calculate'|'recommend';
type Draft={stage:Stage;stageAnswers:Record<Stage,string>;draftAnswer:string;timer:{mode:'untimed'|'timed';elapsedSeconds:number}};
const stages:Stage[]=['clarify','structure','calculate','recommend'];
const labels:Record<Stage,string>={clarify:'Clarify',structure:'Structure',calculate:'Calculate',recommend:'Recommend'};
const combine=(draft:Draft)=>stages.filter(key=>draft.stageAnswers[key].trim()).map(key=>`${labels[key]}\n${draft.stageAnswers[key].trim()}`).join('\n\n');
function initialDraft(session:Practice,key:string):Draft {
  const initial:Draft={stage:session.stage||'clarify',stageAnswers:{clarify:'',structure:'',calculate:'',recommend:'',...session.stageAnswers},draftAnswer:session.draftAnswer??session.answer,timer:{mode:'untimed',elapsedSeconds:session.timer?.elapsedSeconds||0}};
  try{
    const saved=JSON.parse(localStorage.getItem(key)||'null') as Draft|null;
    if(saved&&stages.includes(saved.stage)&&typeof saved.draftAnswer==='string'&&saved.draftAnswer.length<=16000&&saved.stageAnswers&&stages.every(stage=>typeof saved.stageAnswers[stage]==='string'&&saved.stageAnswers[stage].length<=12000)&&Number.isInteger(saved.timer?.elapsedSeconds)&&saved.timer.elapsedSeconds>=0&&saved.timer.elapsedSeconds<=604800)return {...saved,timer:{...saved.timer,mode:'untimed'}};
  }catch{/* A corrupt or unavailable browser cache must not hide the server copy. */}
  return initial;
}

export function PracticeSession({session,provider,onSaved}:{session:Practice;provider:string;onSaved:(message:string)=>Promise<void>}) {
  const [coach,setCoach]=useState(session.reviewProviders?.length===2||session.kind==='document_review'?'pair':session.reviewProviders?.[0]??'codex');
  const cacheKey=`stevie:practice-draft:${session.id}`;
  const [draft,setDraft]=useState(()=>initialDraft(session,cacheKey));
  const [saving,setSaving]=useState(false),[submitting,setSubmitting]=useState(false),[error,setError]=useState<string|null>(null),[saveLabel,setSaveLabel]=useState('Your draft saves automatically.');
  const latest=useRef(draft),dirty=useRef(false),mounted=useRef(true),queue=useRef<Promise<boolean>>(Promise.resolve(true));
  const onSavedRef=useRef(onSaved);onSavedRef.current=onSaved;
  const waiting=['queued','running','evaluating','reviewing'].includes(session.status);
  const structured=['case','market-sizing','chart-reasoning'].includes(session.kind);
  const staged=structured&&stages.some(stage=>draft.stageAnswers[stage].trim());
  const answer=staged?combine(draft):draft.draftAnswer;
  const answerLength=answer.trim().length;
  const prompt=session.sourceSnapshot?.content||session.prompt.replace(/^SYNTHETIC TRAINING EXERCISE\nThe scenario and any figures below are training fixtures, not employer-supplied material\.\n\n/,'');
  function change(next:Draft){
    latest.current=next;dirty.current=true;setDraft(next);setSaveLabel('Saving draft…');
    try{localStorage.setItem(cacheKey,JSON.stringify(next));}catch{setSaveLabel('Browser recovery unavailable; saving to SteVie.');}
  }
  function flush():Promise<boolean>{
    const snapshot=latest.current;
    queue.current=queue.current.catch(()=>false).then(async()=>{
      if(!dirty.current)return true;
      if(mounted.current){setSaving(true);setError(null);}
      try{
        await api(`/practice/${session.id}/progress`,'PATCH',snapshot);
        if(JSON.stringify(latest.current)===JSON.stringify(snapshot)){
          dirty.current=false;
          try{localStorage.removeItem(cacheKey);}catch{/* Server save succeeded. */}
          if(mounted.current)setSaveLabel('Saved in SteVie.');
        }
        await onSavedRef.current('');
        return true;
      }catch(e){if(mounted.current){setError((e as Error).message);setSaveLabel('Not saved to SteVie. Keep this page open and retry.');}return false;}
      finally{if(mounted.current)setSaving(false);}
    });
    return queue.current;
  }
  const flushRef=useRef(flush);flushRef.current=flush;
  useEffect(()=>{
    mounted.current=true;
    try{if(localStorage.getItem(cacheKey)){dirty.current=true;void flushRef.current();}}catch{/* Recovery cache is optional. */}
    const beforeUnload=(event:BeforeUnloadEvent)=>{if(dirty.current){event.preventDefault();event.returnValue='';}};
    window.addEventListener('beforeunload',beforeUnload);
    return()=>{mounted.current=false;window.removeEventListener('beforeunload',beforeUnload);void flushRef.current();};
  },[]);
  useEffect(()=>{if(!dirty.current)return;const timer=window.setTimeout(()=>void flushRef.current(),700);return()=>window.clearTimeout(timer);},[draft]);
  useEffect(()=>{
    if(draft.timer.mode!=='timed'||waiting)return;
    const start=Date.now(),base=draft.timer.elapsedSeconds;
    const tick=window.setInterval(()=>{
      const elapsed=Math.min(604800,base+Math.floor((Date.now()-start)/1000));
      change({...latest.current,timer:{mode:'timed',elapsedSeconds:elapsed}});
    },1000);
    return()=>window.clearInterval(tick);
  },[draft.timer.mode,waiting]);
  async function submit(){
    setSubmitting(true);setError(null);
    try{
      if(!await flush())return;
      await api(`/practice/${session.id}/answer`,'POST',{answer,provider:coach==='pair'?'codex':coach,...(coach==='pair'?{reviewProvider:'claude-code'}:{})});
      await onSavedRef.current('Answer submitted for feedback');
    }catch(e){setError((e as Error).message);}finally{setSubmitting(false);}
  }
  const time=`${String(Math.floor(draft.timer.elapsedSeconds/60)).padStart(2,'0')}:${String(draft.timer.elapsedSeconds%60).padStart(2,'0')}`;
  return <section className="panel practice-session">
    <div className="panel-heading"><div><span className="eyebrow">{session.kind==='document_review'?'DOCUMENT REVIEW':session.synthetic===false?'SOURCE-BASED EXERCISE':'TRAINING EXERCISE'}</span><h2>{session.title}</h2><p className="practice-source-label">{session.kind==='document_review'?'Saved document text; critique does not approve or rewrite it.':session.sourceLabel||'Synthetic training exercise'}</p></div>
      <div className="practice-timer"><span role="timer" aria-label={`Elapsed time ${time}`} aria-live="off">{time}</span><button className="icon-button" disabled={waiting} aria-label={draft.timer.mode==='timed'?'Pause timer':'Start timer'} onClick={()=>change({...draft,timer:{...draft.timer,mode:draft.timer.mode==='timed'?'untimed':'timed'}})}>{draft.timer.mode==='timed'?<Pause size={16}/>:<Play size={16}/>}</button><button className="icon-button" aria-label="Reset timer" onClick={()=>change({...draft,timer:{mode:'untimed',elapsedSeconds:0}})}><RotateCcw size={16}/></button></div>
    </div>
    <div className="practice-content">
      {session.sourceSnapshot&&<details className="practice-provenance"><summary>About this case material</summary><p>From {session.sourceSnapshot.source} · saved {dateLabel(session.sourceSnapshot.updatedAt,true)}. This session keeps the source version it started with.</p>{session.sourceSnapshot.url&&<ExternalLink url={session.sourceSnapshot.url}>Open original source</ExternalLink>}{session.sourceSnapshot.truncated&&<p>Only the first 16,000 characters are included. Check the original for missing exhibits.</p>}</details>}
      <div className="practice-prompt"><RichText text={prompt}/></div>
      {structured&&<><div className="practice-stage-tabs" role="group" aria-label="Practice stages">{stages.map(stage=><button key={stage} aria-pressed={draft.stage===stage} className={draft.stage===stage?'active':''} onClick={()=>change({...draft,stage})}>{labels[stage]}</button>)}</div><Field label={`${labels[draft.stage]} notes`} hint="All four stages are included when you request feedback."><textarea rows={9} maxLength={12000} value={draft.stageAnswers[draft.stage]} onChange={e=>change({...draft,stageAnswers:{...draft.stageAnswers,[draft.stage]:e.target.value}})}/></Field></>}
      {!structured&&<Field label="Your answer" hint="Your working draft saves automatically. Feedback uses the answer you submit."><textarea rows={10} maxLength={16000} value={draft.draftAnswer} onChange={e=>change({...draft,draftAnswer:e.target.value})}/></Field>}
      {structured&&draft.draftAnswer&&<details><summary>Previous answer — preserved</summary><RichText text={draft.draftAnswer}/><p>When you add stage notes, new feedback uses those notes. This earlier answer is kept here.</p></details>}
      <div className="practice-progress-actions"><span className="muted" role="status">{saveLabel}</span><button className="button secondary" disabled={saving} onClick={()=>void flush()}><Save size={16}/>Save now</button></div>
      <ErrorMessage error={error}/>{answerLength>16000&&<p role="alert">Your combined notes exceed 16,000 characters. Shorten the answer before requesting feedback; your notes remain saved.</p>}
      <Field label="Who reviews this answer?" hint="The two-model option shares the answer and retrieved context with both providers, makes two calls and saves both opinions. It does not guarantee agreement."><select value={coach} disabled={waiting} onChange={e=>setCoach(e.target.value)}><option value="codex">Codex coach</option><option value="claude-code">Claude coach</option><option value="pair">Codex + Claude challenge</option></select></Field>{session.status==='failed'&&session.feedback&&<p role="alert">The review round did not finish. The first opinion is preserved below; check the task queue for the failure.</p>}<div className="answer-actions"><span className="muted">{answerLength?answer.trim().split(/\s+/).length:0} words · {answerLength.toLocaleString()} / 16,000 characters</span><button className="button primary" disabled={answerLength<20||answerLength>16000||submitting||waiting} onClick={()=>void submit()}>{submitting||waiting?<Spinner label={waiting?'Preparing feedback':'Submitting'}/>:<><Send size={16}/>{session.feedback?'Review revised answer':'Get feedback'}</>}</button></div>
      {session.feedback&&<div className="feedback-panel"><div className="feedback-heading"><h3>Feedback on your submitted answer</h3>{session.score!==null&&<span className="feedback-score">{session.score}<small>/100</small></span>}</div>{session.answer!==answer&&<p>You have changed your draft since this feedback. Submit it again for a new review.</p>}<RichText text={session.feedback}/></div>}
    </div>
  </section>;
}
