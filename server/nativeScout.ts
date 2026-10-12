import {createHash} from 'node:crypto';
import {Router} from 'express';
import {z} from 'zod';
import {id,now,type Store,type Task,type Job,type Evidence,type Settings} from './db.js';
import {assessScout} from './ai.js';
import {importScouting,isDuplicateRole} from './scouting.js';
import {defaultFeeds,feedSchema,fetchFeed,shortlistMatch,type Posting} from './scoutFeeds.js';

const terms=z.array(z.string().trim().min(2).max(100)).min(1).max(30);
export const nativeConfigSchema=z.object({enabled:z.boolean(),times:z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).min(1).max(3),timeZone:z.literal('Europe/Dublin'),feeds:z.array(feedSchema).min(1).max(15),locations:terms,roles:terms}).strict();
export type NativeConfig=z.infer<typeof nativeConfigSchema>;
export const defaultConfig:NativeConfig={enabled:false,times:['09:00','14:00','19:00'],timeZone:'Europe/Dublin',feeds:defaultFeeds,locations:['Dublin','London','Ireland','United Kingdom','UK','Remote Europe'],roles:['analyst','consultant','graduate','product','operations','strategy','business']};
export const nativeConfig=(store:Store)=>nativeConfigSchema.parse(store.meta('nativeScoutConfig')??defaultConfig);
export function dueSlot(config:NativeConfig,date:Date):string|undefined{
  if(!config.enabled)return;
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:config.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));const clock=`${p.hour}:${p.minute}`;
  const time=[...config.times].sort().filter(t=>t<=clock).at(-1);
  return time?`${p.year}-${p.month}-${p.day}T${time}`:undefined;
}
export function queueScout(store:Store,manual=false,date=new Date()):Task|undefined{
  return store.transaction(()=>{
    const config=nativeConfig(store),slot=dueSlot(config,date);
    if(!manual&&(!slot||String(store.meta('nativeScoutSlot')??'')>=slot))return;
    if(store.all<Task>('tasks').some(t=>t.kind==='scout'&&['queued','running'].includes(t.status)))return;
    if(!config.feeds.some(f=>f.enabled))throw new Error('Enable at least one employer feed.');
    if(!store.meta('scoutingPreferences'))throw new Error('Save your career preferences before scouting.');
    const day=date.toISOString().slice(0,10);
    if(store.all<Task>('tasks').filter(t=>t.kind==='scout'&&t.createdAt.startsWith(day)).length>=6)throw new Error('Six scout runs have already been queued today. Try tomorrow.');
    const task:Task={id:id(),kind:'scout',jobId:null,status:'queued',error:null,createdAt:now(),finishedAt:null,provider:store.meta<Settings>('settings')!.provider,attempts:0};
    store.save('tasks',task);if(slot)store.setMeta('nativeScoutSlot',slot);
    store.activity(manual?'Career scout queued from SteVie.':'Scheduled career scout queued by SteVie.');return task;
  });
}
type SourceResult={company:string;status:'ok'|'failed';postings:number;error?:string};
type Run={taskId:string;startedAt:string;finishedAt?:string;status:'running'|'done'|'partial'|'failed';sources:SourceResult[];shortlisted:number;decisions?:{title:string;company:string;eligibility:string;reason:string}[];created?:number;queued?:number;held?:number;error?:string};
function saveRun(store:Store,run:Run){store.setMeta('nativeScoutRun',run);const old=store.meta<Run[]>('nativeScoutHistory')??[];store.setMeta('nativeScoutHistory',[run,...old.filter(r=>r.taskId!==run.taskId)].slice(0,30));}
export async function runNativeScout(store:Store,task:Task,enqueue:(job:Job)=>Task|undefined,deps={fetchFeed,assessScout}){
  const config=nativeConfig(store),preferences=store.meta('scoutingPreferences');
  const evidence=store.all<Evidence>('evidence').filter(e=>e.status!=='unresolved');
  const run:Run={taskId:task.id,startedAt:now(),status:'running',sources:[],shortlisted:0};saveRun(store,run);
  try{
    if(!preferences)throw new Error('Career preferences are missing.');
    const postings:Posting[]=[];
    // Bounded requests; failures remain visible even when another source succeeds.
    for(const feed of config.feeds.filter(f=>f.enabled)){
      try{const found=await deps.fetchFeed(feed);postings.push(...found);run.sources.push({company:feed.company,status:'ok',postings:found.length});}
      catch{run.sources.push({company:feed.company,status:'failed',postings:0,error:'Feed unavailable or invalid. Check the board name and connection.'});}
      saveRun(store,run);
    }
    if(!run.sources.some(s=>s.status==='ok'))throw new Error('No employer feed could be read. No roles or drafts were created.');
    const fingerprint=createHash('sha256').update(JSON.stringify({preferences,evidence,locations:config.locations,roles:config.roles})).digest('hex');
    const seen=store.meta<Record<string,number>>('nativeScoutSeen')??{};
    const hash=(p:Posting)=>createHash('sha256').update(fingerprint+JSON.stringify(p)).digest('hex');
    const unique=[...new Map(postings.map(p=>[p.url,p])).values()];
    const candidates=unique.filter(p=>shortlistMatch(p,config.locations,config.roles)&&!isDuplicateRole(store,p)&&Date.now()-(seen[hash(p)]??0)>7*86400000).sort((a,b)=>Number(/graduate|junior|associate/i.test(b.title))-Number(/graduate|junior|associate/i.test(a.title))).slice(0,7);
    run.shortlisted=candidates.length;saveRun(store,run);
    const decisions=candidates.length?await deps.assessScout({provider:task.provider!,preferences,evidence,candidates}):[];
    run.decisions=decisions.map(d=>({title:candidates.find(c=>c.key===d.key)!.title,company:candidates.find(c=>c.key===d.key)!.company,eligibility:d.eligibility,reason:d.reason}));saveRun(store,run);
    const result=importScouting(store,{checkedAt:now(),queries:config.feeds.filter(f=>f.enabled).map(f=>`${f.kind}:${f.board}`),roles:candidates.map(candidate=>{
      const decision=decisions.find(d=>d.key===candidate.key);if(!decision)throw new Error('Scout assessment was incomplete.');
      const {key,...posting}=candidate;
      return {...posting,eligibility:decision.eligibility,eligibilityNotes:decision.reason};
    })},enqueue);
    for(const p of candidates)seen[hash(p)]=Date.now();
    store.setMeta('nativeScoutSeen',Object.fromEntries(Object.entries(seen).filter(([,stamp])=>Date.now()-stamp<7*86400000).slice(-5000)));
    Object.assign(run,result,{status:run.sources.some(s=>s.status==='failed')?'partial':'done',finishedAt:now()});saveRun(store,run);return run;
  }catch(error){run.status='failed';run.finishedAt=now();run.error=error instanceof Error?error.message.slice(0,500):'Scout failed.';saveRun(store,run);throw error;}
}
export function createNativeScoutRouter(store:Store){
  const router=Router();
  router.get('/',(_req,res)=>res.json({config:nativeConfig(store),run:store.meta('nativeScoutRun')??null,history:store.meta('nativeScoutHistory')??[],tasks:store.all<Task>('tasks').filter(t=>t.kind==='scout').slice(0,10)}));
  router.put('/',(req,res)=>{const config=nativeConfigSchema.parse(req.body);store.setMeta('nativeScoutConfig',config);res.json(config);});
  router.post('/run',(_req,res)=>{try{const task=queueScout(store,true);res.status(task?202:409).json(task??{error:'A scout is already queued or running.'});}catch(error){res.status(422).json({error:(error as Error).message});}});
  return router;
}
