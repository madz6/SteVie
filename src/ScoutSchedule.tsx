import {NativeScout} from './NativeScout';
import {useEffect,useState,type FormEvent} from 'react';
import {api} from './api';
import {dateLabel,ErrorMessage,Field,Spinner} from './components';
type Preferences={roles:string[];locations:string[];notes:string};
type State={preferences:Preferences|null;schedule:{enabled:boolean;times:string[];timeZone:string}|null;lastRun:{lastRunAt:string;created:number;queued:number;held:number;skipped:number}|null};
export function ScoutSchedule(){
  const [state,setState]=useState<State|null>(null),[error,setError]=useState<string|null>(null),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false);
  async function load(){try{setState(await api<State>('/scouting'));setError(null);}catch(e){setError((e as Error).message);}}
  useEffect(()=>{void load();const timer=setInterval(()=>void load(),60000);return()=>clearInterval(timer);},[]);
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();const data=new FormData(event.currentTarget);setBusy(true);setError(null);try{await api('/scouting/preferences','PUT',{roles:String(data.get('roles')).split('\n').map(s=>s.trim()).filter(Boolean),locations:String(data.get('locations')).split('\n').map(s=>s.trim()).filter(Boolean),notes:String(data.get('notes'))});setEditing(false);await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <><NativeScout/><section className="panel scout-schedule"><h2>Career preferences</h2><ErrorMessage error={error}/>{!state&&!error&&<Spinner label="Loading scouting setup"/>}{state&&<>
    {state.preferences&&<><h3>Your search preferences</h3><p><strong>Roles:</strong> {state.preferences.roles.join(' · ')}</p><p><strong>Locations:</strong> {state.preferences.locations.join(' · ')}</p><p>{state.preferences.notes}</p></>}
    <button className="button secondary" onClick={()=>setEditing(value=>!value)} aria-expanded={editing}>{editing?'Cancel editing':'Edit search preferences'}</button>
    {editing&&<form className="form-stack" onSubmit={save}><Field label="Role families (one per line)"><textarea name="roles" required rows={5} defaultValue={state.preferences?.roles.join('\n')}/></Field><Field label="Locations (one per line)"><textarea name="locations" required rows={3} defaultValue={state.preferences?.locations.join('\n')}/></Field><Field label="Priorities and exclusions"><textarea name="notes" rows={5} maxLength={5000} defaultValue={state.preferences?.notes}/></Field><button className="button primary" disabled={busy}>{busy?'Saving…':'Save preferences'}</button></form>}
  </>}</section></>;
}
