import {useState,type FormEvent} from 'react';
import {api} from './api';
import type {Evidence} from './types';
import {ErrorMessage,Field,Modal,Spinner} from './components';

export function EvidenceEditor({item,source='',text='',onClose,onSaved}:{item?:Evidence;source?:string;text?:string;onClose:()=>void;onSaved:()=>Promise<void>}){
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError(null);const body=Object.fromEntries(new FormData(event.currentTarget).entries());try{await api(item?`/evidence/${item.id}`:'/evidence',item?'PATCH':'POST',body);await onSaved();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <Modal title={item?'Edit career evidence':'Add career evidence'} onClose={()=>{if(!busy)onClose();}}><form className="modal-form" onSubmit={submit}>
    <p>Save one fact or a closely related group of facts. Include dates and distinguish measured results from estimates. Only confirm what you can support.</p>
    <Field label="Category"><input name="category" required maxLength={300} defaultValue={item?.category} placeholder="Experience, education, skills or contact details"/></Field>
    <Field label="Fact or contact details"><textarea name="text" required minLength={10} maxLength={6000} rows={7} defaultValue={item?.text??text} placeholder="For contact details: the email, phone and profile link you want on applications."/></Field>
    <Field label="Source"><input name="source" required maxLength={300} defaultValue={item?.source??source} placeholder="Where this came from, such as a transcript, CV or your confirmation"/></Field>
    <Field label="Evidence status"><select name="status" defaultValue={item?.status??'user_stated'}><option value="user_stated">Stated by me - still needs confirmation</option><option value="verified">Checked by me against the source</option><option value="unresolved">Unresolved - exclude from drafts</option></select></Field>
    <p className="muted">Changing evidence marks drafts that used it for preparation again. Existing text and its source references are retained.</p>
    <ErrorMessage error={error}/><div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy?<Spinner label="Saving evidence"/>:'Save evidence'}</button></div>
  </form></Modal>;
}
