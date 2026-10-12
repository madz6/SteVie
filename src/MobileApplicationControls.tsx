import {useState} from 'react';
import {api} from './api';
import {Field,ErrorMessage} from './components';
import {mobileLabels,type MobileEase} from './mobileApplications';
import type {Job} from './types';

export function MobileApplicationControls({job,onSaved}:{job:Job;onSaved:(message:string)=>Promise<void>}){
  const [ease,setEase]=useState<MobileEase>(job.mobileEase??'unknown'),[note,setNote]=useState(job.mobileNote??''),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  return <section className="detail-section"><h3>Apply from your phone</h3><p>This is your rating of the actual application flow. A saved posting link alone cannot confirm how easy the form is.</p><form className="form-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);setError(null);try{await api(`/jobs/${job.id}`,'PATCH',{mobileEase:ease,mobileNote:note});await onSaved('Phone application rating saved');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>
    <Field label="Application device"><select value={ease} onChange={e=>setEase(e.target.value as MobileEase)}>{Object.entries(mobileLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
    <Field label="What makes it easy or difficult?" hint="For example: CV upload only; long answers; account setup; timed assessment."><textarea rows={2} maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></Field><ErrorMessage error={error}/><button className="button secondary" disabled={busy||(ease===(job.mobileEase??'unknown')&&note===(job.mobileNote??''))}>Save phone rating</button>
  </form></section>;
}
