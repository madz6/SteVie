import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { BookOpen, BriefcaseBusiness, Check, ChevronRight, CircleHelp, Database, GraduationCap, Inbox, LayoutDashboard, Menu, Radar, RefreshCw, Search, Settings2, ShieldCheck, Users, X } from 'lucide-react';
import { api } from './api';
import type { Bootstrap } from './types';
import { ErrorMessage, Spinner } from './components';
import { Applications, JobForm } from './Applications';
import { PracticeView } from './Practice';
import { PeopleView } from './People';
import { LearningView, ProfileView } from './Workspace';
import { Connections } from './Connections';
import { KnowledgeView } from './Knowledge';
import { ScoutView } from './Scout';
import { MissionControl } from './MissionControl';
import { Recovery } from './Recovery';
import { DataTransfer } from './DataTransfer';

type View = 'today'|'applications'|'practice'|'people'|'learning'|'scout'|'knowledge'|'profile'|'connections'|'inbox'|'data';
const navigation:{id:View;label:string;icon:ComponentType<{size?:number;strokeWidth?:number}>}[] = [
  {id:'today',label:'Today',icon:LayoutDashboard},{id:'applications',label:'Applications',icon:BriefcaseBusiness},{id:'practice',label:'Practice',icon:CircleHelp},{id:'inbox',label:'Inbox recovery',icon:Inbox},{id:'people',label:'People',icon:Users},{id:'learning',label:'Learning',icon:GraduationCap},{id:'scout',label:'Scout',icon:Radar},{id:'knowledge',label:'Knowledge base',icon:BookOpen},{id:'profile',label:'My evidence',icon:ShieldCheck},{id:'data',label:'Import & export',icon:Database},{id:'connections',label:'Connections',icon:Settings2},
];
function route(){const params=new URLSearchParams(window.location.search);const value=params.get('view');return {view:navigation.some(item=>item.id===value)?value as View:'today' as View,jobId:params.get('job'),documentId:params.get('document')};}

export default function App() {
  const [data,setData]=useState<Bootstrap|null>(null), [loadError,setLoadError]=useState<string|null>(null), [notice,setNotice]=useState('');
  const [view,setView]=useState<View>(()=>route().view), [jobId,setJobId]=useState<string|null>(()=>route().jobId), [query,setQuery]=useState(''), [addJob,setAddJob]=useState(false), [mobileMore,setMobileMore]=useState(false);
  const [refreshing,setRefreshing]=useState(false),[documentId,setDocumentId]=useState<string|null>(()=>route().documentId);
  const mounted=useRef(true);
  const refresh=useCallback(async()=>{
    try { const result=await api<Bootstrap>('/bootstrap'); if(!result.profile||!result.settings||!['jobs','tasks','documents','practice','contacts','learning','evidence','knowledge','scouts','activity','integrations'].every(key=>Array.isArray(result[key as keyof Bootstrap])))throw new Error('An older SteVie server is running. Stop it in its terminal and restart from the SteVie Reboot folder, then reload this page. Your saved data is unchanged.'); if(mounted.current){setData(result);setLoadError(null);} }
    catch(error){ if(mounted.current)setLoadError((error as Error).message); }
  },[]);
  useEffect(()=>{mounted.current=true;void refresh();return()=>{mounted.current=false;};},[refresh]);
  const hasWork=!!data?.tasks.some(task=>task.status==='queued'||task.status==='running');
  useEffect(()=>{if(!hasWork)return;const timer=window.setInterval(()=>void refresh(),3000);return()=>window.clearInterval(timer);},[hasWork,refresh]);
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(''),5500);return()=>window.clearTimeout(timer);},[notice]);
  const navigate=(next:View,id:string|null=next==='applications'?jobId:null,focus=true,docId:string|null=null)=>{const url=new URL(window.location.href);url.searchParams.set('view',next);if(id)url.searchParams.set('job',id);else url.searchParams.delete('job');if(docId)url.searchParams.set('document',docId);else url.searchParams.delete('document');setDocumentId(docId);url.hash='';if(url.href!==window.location.href)window.history.pushState({},'',url);setView(next);setJobId(id);setMobileMore(false);window.scrollTo({top:0,behavior:'instant'});if(focus)requestAnimationFrame(()=>document.getElementById('main-content')?.focus());};
  const openJob=(id:string,docId?:string)=>{setQuery('');navigate('applications',id,true,docId||null);};
  useEffect(()=>{const onPop=()=>{const next=route();setView(next.view);setJobId(next.jobId);setDocumentId(next.documentId);setMobileMore(false);requestAnimationFrame(()=>document.getElementById('main-content')?.focus());};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);
  useEffect(()=>{document.title=`${navigation.find(item=>item.id===view)?.label||'Workspace'} · SteVie`;},[view]);
  useEffect(()=>{if(!mobileMore)return;const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setMobileMore(false);document.getElementById('mobile-more-toggle')?.focus();}};document.addEventListener('keydown',onKey);return()=>document.removeEventListener('keydown',onKey);},[mobileMore]);
  const onSaved=async(message:string)=>{await refresh();setNotice(message);};
  const selectedJob=data?.jobs.find(job=>job.id===jobId)||null;

  if(!data)return <main className="boot-screen"><div className="brand boot-brand">Ste<span>Vie</span><span className="brand-dot">.</span></div><p>Your next chapter starts here.</p>{loadError?<><ErrorMessage error={loadError}/><button className="button primary" onClick={()=>void refresh()}><RefreshCw size={16}/>Try again</button></>:<Spinner label="Opening your workspace"/>}</main>;

  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <aside className="sidebar">
      <button className="brand" onClick={()=>navigate('today')} aria-label="SteVie home">Ste<span>Vie</span><span className="brand-dot">.</span></button>
      <div className="sidebar-caption">YOUR NEXT CHAPTER</div>
      <nav className="desktop-nav" aria-label="Main navigation">{navigation.map(({id,label,icon:Icon},index)=><button key={id} className={`nav-item ${view===id?'active':''} ${index===7?'nav-separated':''}`} onClick={()=>navigate(id)} aria-current={view===id?'page':undefined}><Icon size={19} strokeWidth={1.7}/><span>{label}</span>{id==='applications' && <small>{data.jobs.filter(job=>!['rejected','archived'].includes(job.status)).length}</small>}{id==='knowledge' && data.knowledge.length>0 && <small>{data.knowledge.length}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="private-workspace"><span className="online-dot"/>Private workspace</div><button className="profile-shortcut" onClick={()=>navigate('profile')}><span className="avatar">{data.profile.name.split(' ').map(part=>part[0]).slice(0,2).join('')}</span><span><strong>{data.profile.name}</strong><small>{data.profile.location || 'Your career workspace'}</small></span><ChevronRight size={16}/></button></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13}/><strong>{navigation.find(item=>item.id===view)?.label}</strong></div><div className="topbar-actions"><label className="global-search"><Search size={16}/><input aria-label="Search applications" placeholder="Find an application…" value={query} onChange={e=>{setQuery(e.target.value);if(view!=='applications')navigate('applications',null,false);}}/></label><button className="icon-button refresh-button" disabled={refreshing} onClick={async()=>{setRefreshing(true);await refresh();setRefreshing(false);}} aria-label="Refresh workspace"><RefreshCw size={17} className={refreshing?'spin':''}/></button><span className="topbar-date">{new Intl.DateTimeFormat('en-IE',{day:'numeric',month:'short',timeZone:'Europe/Dublin'}).format(new Date())}</span></div></header>
      <main id="main-content" className={`main-content view-${view}`} tabIndex={-1}>
        {loadError && <div className="sync-error"><ErrorMessage error={`The workspace couldn't refresh. Your last loaded information is shown. ${loadError}`}/></div>}
        {view==='today' && <MissionControl data={data} openJob={openJob} navigate={navigate} addJob={()=>setAddJob(true)} refresh={refresh}/>}
        {view==='applications' && <Applications documentId={documentId} data={data} selectedJob={selectedJob} onSelect={id=>navigate('applications',id)} query={query} setQuery={setQuery} addJob={()=>setAddJob(true)} onSaved={onSaved}/>}
        {view==='inbox' && <Recovery jobs={data.jobs} onSaved={onSaved} openJob={openJob}/>}
        {view==='data' && <DataTransfer onSaved={onSaved}/>}
        {view==='practice' && <PracticeView data={data} onSaved={onSaved}/>}
        {view==='people' && <PeopleView data={data} openJob={openJob} onSaved={onSaved}/>}
        {view==='learning' && <LearningView items={data.learning} onSaved={onSaved}/>}
        {view==='scout' && <ScoutView items={data.scouts} settings={data.settings} onSaved={onSaved}/>}
        {view==='knowledge' && <KnowledgeView items={data.knowledge} onSaved={onSaved}/>}
        {view==='profile' && <ProfileView profile={data.profile} evidence={data.evidence} onSaved={onSaved}/>}
        {view==='connections' && <Connections data={data} onSaved={onSaved}/>}
      </main>
    </div>
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}<button aria-label="Dismiss notification" onClick={()=>setNotice('')}><X size={15}/></button></div>}
    <nav className="mobile-nav" aria-label="Mobile navigation">{navigation.slice(0,3).map(({id,label,icon:Icon})=><button key={id} onClick={()=>navigate(id)} className={view===id?'active':''} aria-current={view===id?'page':undefined}><Icon size={21}/><span>{label}</span></button>)}<button id="mobile-more-toggle" aria-controls="mobile-more-panel" className={mobileMore||navigation.slice(3).some(item=>item.id===view)?'active':''} onClick={()=>setMobileMore(!mobileMore)} aria-expanded={mobileMore}><Menu size={21}/><span>More</span></button></nav>
    {mobileMore && <nav id="mobile-more-panel" className="mobile-more" aria-label="More workspace views"><div className="eyebrow">YOUR WORKSPACE</div>{navigation.slice(3).map(({id,label,icon:Icon})=><button key={id} onClick={()=>navigate(id)} aria-current={view===id?'page':undefined}><Icon size={20}/>{label}<ChevronRight size={16}/></button>)}</nav>}
    {addJob && <JobForm onClose={()=>setAddJob(false)} onSaved={async job=>{setAddJob(false);await onSaved('Application saved');openJob(job.id);}}/>}
  </div>;
}


