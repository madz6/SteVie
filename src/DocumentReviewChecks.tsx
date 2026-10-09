import {canReviewCheck} from './documentChecks';
import type {Document} from './types';
import {Field} from './components';
export type ReviewNote={flag:string;note:string};
export function DocumentReviewChecks({doc,checks,setChecks,edited}:{doc:Document;checks:ReviewNote[];setChecks:(checks:ReviewNote[])=>void;edited:boolean}){
  const flags=[...new Set([...(doc.generationFlags??doc.flags),...doc.flags])];
  if(!flags.length)return null;
  return <details className="review-checklist"><summary>Review checks ({doc.flags.length} unresolved)</summary>
    <p>Correct the draft or its evidence first. For a check you have resolved, record what you checked and why. Saving a review note does not verify a fact independently.</p>
    {edited&&<p role="status">Save your text changes before reviewing checks. Editing clears previous review notes for this draft.</p>}
    {flags.map((flag,index)=>{const check=checks.find(item=>item.flag===flag);const reviewable=(doc.generationFlags??doc.flags).includes(flag)&&canReviewCheck(flag);return <div className="review-check" key={flag}>
      {reviewable?<label><input type="checkbox" checked={!!check} disabled={edited} onChange={event=>setChecks(event.target.checked?[...checks,{flag,note:''}]:checks.filter(item=>item.flag!==flag))}/><span>{flag}</span></label>:<p><strong>Correction required:</strong> {flag}</p>}
      {check&&<Field label={`How you resolved check ${index+1}`}><textarea disabled={edited} rows={2} minLength={12} maxLength={2000} value={check.note} onChange={event=>setChecks(checks.map(item=>item.flag===flag?{...item,note:event.target.value}:item))} placeholder="Record the supporting source, confirmed detail or correction you made."/></Field>}
    </div>;})}
  </details>;
}
