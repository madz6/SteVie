import {useState} from 'react';
import {api} from './api';
import {ErrorMessage} from './components';
export function DocumentPeerReview({documentId,disabled}:{documentId:string;disabled:boolean}){
  const [busy,setBusy]=useState(false),[queued,setQueued]=useState(false),[error,setError]=useState<string|null>(null);
  return <section className="connection-note"><h3>Codex + Claude document review</h3><p>Send the saved draft, role requirements and candidate evidence to both signed-in providers. Codex critiques it; Claude challenges that critique. Two model calls; no automatic rewrite, approval or submission.</p><ErrorMessage error={error}/>{queued?<p role="status">Review queued. <a href="/?view=practice">Open Practice to see the saved discussion</a>.</p>:<button className="button secondary" disabled={busy||disabled} onClick={async()=>{setBusy(true);setError(null);try{await api(`/documents/${documentId}/peer-review`,'POST',{});setQueued(true);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>{busy?'Queuing review…':'Ask Codex + Claude to review'}</button>}{disabled&&<p>Save your changes before requesting review.</p>}</section>;
}
