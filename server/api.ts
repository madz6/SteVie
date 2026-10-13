import {networkingFields,outreachOutput,outreachContext,outreachFingerprint} from './networking.js';
import {peerReview} from './peerReview.js';
import {createNativeScoutRouter,queueScout,runNativeScout} from './nativeScout.js';
import {assertCompletePack,quarantineIncompleteHistory} from './packValidation.js';
import {canReviewCheck} from '../src/documentChecks.js';
import express, { type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { getStore, id, now, type Store, type Job, type Task, type Document, type Practice, type Contact, type Learning, type Evidence, type Settings, type Profile, type Integration, type KnowledgeItem, type ScoutTarget } from './db.js';
import { generationContext } from './import.js';
import { factualFlags, renderPdf, safeFilename } from './documents.js';
import { providerStatuses, testProvider, generateApplication, coachPractice, generateOutreach } from './ai.js';
import { createInboxRouter, type InboxCoverage } from './inbox.js';
import { createPortabilityRouter } from './portability.js';
import { parseKnowledgeUpload, retrieveKnowledge } from './knowledge.js';
import { createScoutingRouter } from './scouting.js';
import { buildPractice } from './practice.js';
export { buildPractice } from './practice.js';

const text=z.string().trim();
const short=text.max(300);
const url=text.max(2000).refine(value=>!value||/^https?:\/\/[^\s]+$/i.test(value),'Use a full http or https URL.');
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const parsed=new Date(value+'T12:00:00Z');return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;},'Use a valid calendar date.').nullable();
const providers=z.enum(['codex','claude-code','openai','anthropic']);
const statuses=z.enum(['saved','preparing','ready','applied','interviewing','offer','rejected','archived','unknown']);
const jobInput=z.object({mobileEase:z.enum(['phone','laptop','unknown']).optional(),mobileNote:z.string().max(500).optional(),track:z.enum(['career','income','unclassified']).optional(),employmentType:z.enum(['full_time','part_time','contract','internship','unknown']).optional(),company:short.min(1),title:short.min(1),location:short.optional(),url:url.optional(),source:short.optional(),description:text.max(45000).optional(),deadline:date.optional(),notes:text.max(12000).optional()});
const jobPatch=jobInput.omit({source:true}).partial().extend({status:statuses.optional(),needsReview:z.boolean().optional()});
class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
function requireRecord<T>(item:T|undefined,label:string):T {if(!item)throw new HttpError(404,`${label} not found.`);return item;}
function normalizedUrl(value:string):string {
  if(!value)return '';
  const parsed=new URL(value); parsed.hash='';
  for(const key of [...parsed.searchParams.keys()])if(/^utm_|^(?:ref|source)$/i.test(key))parsed.searchParams.delete(key);
  return parsed.toString().replace(/\/$/,'');
}
const dailyKey=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Dublin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function dailyRoom(store:Store,kind:Task['kind']='application'):boolean {
  if(kind==='outreach'){const usage=store.meta<{date:string;count:number}>('outreachUsage');const used=usage?.date===dailyKey()?usage.count:0;return used+store.all<Task>('tasks').filter(t=>t.kind==='outreach'&&t.status==='queued').length<(store.meta<Settings>('settings')?.dailyLimit||20);}
  if(kind!=='application')return true;
  const usage=store.meta<{date:string;count:number}>('dailyUsage');
  const used=usage?.date===dailyKey()?usage.count:0;
  const queued=store.all<Task>('tasks').filter(t=>t.status==='queued'&&t.kind==='application').length;
  return used+queued<(store.meta<Settings>('settings')?.dailyLimit||20);
}
function publicTask(task:Task):Task {const {provider,practiceId,attempts,...publicFields}=task;return publicFields;}
function invalidateSourceDocuments(store:Store,sourceId:string,kind:'knowledge'|'evidence'){
  if(kind==='evidence')for(const contact of store.all<Contact>('contacts'))if(contact.outreachDrafts?.some(d=>d.evidenceIds.includes(sourceId)))store.save('contacts',{...contact,outreachDrafts:contact.outreachDrafts.map(d=>d.evidenceIds.includes(sourceId)?{...d,stale:true}:d)});
  for(const document of store.all<Document>('documents')){
    const linked=kind==='knowledge'?document.sourceSnapshots?.some(source=>source.id===sourceId):document.evidenceIds?.includes(sourceId);
    if(!linked)continue;
    const warning='Supporting source changed after this document was generated. Prepare a new pack from the current sources before approval.';
    store.save('documents',{...document,reviewChecks:[],status:'needs_review',generationFlags:[...new Set([...(document.generationFlags??document.flags),warning])],flags:[...new Set([...document.flags,warning])]});
    const job=store.get<Job>('jobs',document.jobId);
    if(job)store.save('jobs',{...job,needsReview:true,status:job.status==='ready'?'saved':job.status,updatedAt:now()});
  }
}
function connectorStatuses(store:Store):Integration[] {
  const settings=store.meta<Settings>('settings')!;
  const coverage=store.meta<InboxCoverage>('inboxCoverage');
  return [
    {id:'jumpstart',name:'Jumpstart',status:'setup_required',detail:settings.jumpstartUrl?'Source link saved. Importing roles still requires an authorised connection. Quick Apply is not enabled.':'Add your Jumpstart source link. No feed is connected yet.'},
    {id:'trackr',name:'Trackr',status:'setup_required',detail:settings.trackrUrl?'Source link saved. A Trackr API or export connection is still required.':'Add your Trackr workspace link, then choose an approved export or API connection.'},
    {id:'linkedin',name:'LinkedIn scouting',status:'setup_required',detail:'Link-based scouting is available. Automated people or job collection needs an approved LinkedIn API or user-controlled browser flow; SteVie does not scrape LinkedIn.'},
    {id:'github',name:'GitHub knowledge',status:'setup_required',detail:'Repository links can be saved to the knowledge base. Private repository reading needs a separate GitHub connection.'},
    {id:'knowledge',name:'SteVie knowledge base',status:'connected',detail:'Local source records are available. Add documents, case material, chat links and repository links.'},
    {id:'email',name:'Email',status:'setup_required',detail:coverage?`${coverage.messages} saved messages are available in Inbox recovery. This is a historical search snapshot; automatic mailbox sync is not connected.`:'No mailbox sync is connected. Import a mailbox snapshot in Inbox recovery to rebuild your application history.'},
    {id:'calendar',name:'Calendar',status:'setup_required',detail:'Calendar sync is not connected. Deadlines and follow-ups are stored in SteVie.'},
  ];
}
let integrationCache:{time:number;items:Integration[]}|undefined;
async function integrations(store:Store):Promise<Integration[]> {
  if(!integrationCache||Date.now()-integrationCache.time>30000)integrationCache={time:Date.now(),items:await providerStatuses()};
  return [...integrationCache.items,...connectorStatuses(store)];
}
function queueTask(store:Store,kind:Task['kind'],jobId:string|null,provider:string,practiceId?:string):Task {
  if(!dailyRoom(store,kind))throw new HttpError(429,'Daily application preparation limit reached. Adjust your daily limit in Connections or try tomorrow.');
  const task:Task={id:id(),kind,jobId,provider,practiceId,status:'queued',error:null,createdAt:now(),finishedAt:null,attempts:0};
  return store.save('tasks',task);
}

export function createApi(options:{store?:Store}={}) {
  const store=options.store||getStore();
  const router=express.Router();
  router.use('/portability',createPortabilityRouter(store));
  router.use(express.json({limit:'25mb'}));
  router.use('/inbox',createInboxRouter(store));
  router.use('/scouting/native',createNativeScoutRouter(store));
  router.use('/scouting',createScoutingRouter(store,job=>dailyRoom(store)?queueTask(store,'application',job.id,store.meta<Settings>('settings')!.provider):undefined));
  router.get('/health',(_req,res)=>res.json({ok:true}));
  router.get('/access',(_req,res)=>{
    const value=process.env.STEVIE_PUBLIC_URL;
    let phoneUrl:string|null=null;
    try{const parsed=new URL(value||'');if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)phoneUrl=parsed.origin;}catch{/* Local-only workspace. */}
    res.json({phoneUrl,configured:Boolean(phoneUrl&&process.env.STEVIE_PASSWORD&&process.env.STEVIE_PASSWORD.length>=16),privateNetwork:phoneUrl?new URL(phoneUrl).hostname.endsWith('.ts.net'):false});
  });
  router.get('/bootstrap',async(_req,res)=>res.json({profile:store.meta('profile'),jobs:store.all('jobs'),tasks:store.all<Task>('tasks').slice(0,150).map(publicTask),documents:store.all('documents'),practice:store.all('practice'),contacts:store.all('contacts'),learning:store.all('learning'),evidence:store.all('evidence'),knowledge:store.all<KnowledgeItem>('knowledge'),scouts:store.all<ScoutTarget>('scouts'),activity:store.all('activity').slice(0,80),settings:store.meta('settings'),integrations:await integrations(store)}));
  router.get('/integrations',async(_req,res)=>res.json(await integrations(store)));
  router.post('/integrations/:id/test',async(req,res)=>{
    const provider=providers.safeParse(req.params.id);
    if(provider.success){const result=await testProvider(provider.data);integrationCache=undefined;res.json(result);return;}
    const integration=connectorStatuses(store).find(i=>i.id===req.params.id);
    res.json(requireRecord(integration,'Connection'));
  });
  router.post('/jobs',(req,res)=>{
    const input=jobInput.parse(req.body);
    const job:Job={id:id(),mobileEase:input.mobileEase,mobileNote:input.mobileNote,track:input.track,employmentType:input.employmentType,company:input.company,title:input.title,location:input.location||'',source:input.source||'Added by you',url:normalizedUrl(input.url||''),description:input.description||'',notes:input.notes||'',deadline:input.deadline||null,status:'saved',fit:null,fitReason:'Not assessed',needsReview:false,createdAt:now(),updatedAt:now()};
    store.transaction(()=>{store.save('jobs',job);store.activity(`Saved ${job.title} at ${job.company}.`);});
    res.status(201).json(job);
  });
  router.patch('/jobs/:id',(req,res)=>{
    const job=requireRecord(store.get<Job>('jobs',String(req.params.id)),'Opportunity');
    const patch=jobPatch.parse(req.body);
    if(patch.status==='preparing')throw new HttpError(422,'Use Prepare pack to start preparation.');
    if(patch.status==='ready'&&store.all<Document>('documents').filter(d=>d.jobId===job.id).length===0)throw new HttpError(422,'Prepare and review documents before marking the opportunity ready.');
    const updated={...job,...patch,url:patch.url!==undefined?normalizedUrl(patch.url):job.url,updatedAt:now(),needsReview:patch.needsReview??(patch.status?false:job.needsReview)};
    store.transaction(()=>{store.save('jobs',updated);if(['description','company','title','status'].some(key=>JSON.stringify(job[key as keyof Job])!==JSON.stringify(updated[key as keyof Job])))for(const contact of store.all<Contact>('contacts'))if(contact.jobIds?.includes(job.id)&&contact.outreachDrafts?.length)store.save('contacts',{...contact,outreachDrafts:contact.outreachDrafts.map(d=>({...d,stale:true}))});if(patch.status&&patch.status!==job.status)store.activity(`${job.company}: ${patch.status}.`);});
    res.json(updated);
  });
  router.post('/jobs/:id/prepare',(req,res)=>{
    const input=z.object({provider:providers.optional()}).parse(req.body||{});
    const job=requireRecord(store.get<Job>('jobs',String(req.params.id)),'Opportunity');
    if(job.description.trim().length<80)throw new HttpError(422,'Add the full job description before preparing a tailored application. Historical notes alone are not enough.');
    if(store.all<Task>('tasks').some(t=>t.jobId===job.id&&t.kind==='application'&&['queued','running'].includes(t.status)))throw new HttpError(409,'This application is already being prepared.');
    const task=store.transaction(()=>{const queued=queueTask(store,'application',job.id,input.provider||store.meta<Settings>('settings')!.provider);store.save('jobs',{...job,status:['saved','unknown','ready'].includes(job.status)?'preparing':job.status,updatedAt:now()});store.activity(`Queued an application pack for ${job.company}.`);return queued;});
    res.status(202).json(publicTask(task));
  });
  router.post('/tasks/:id/retry',(req,res)=>{
    const input=z.object({provider:providers.optional()}).parse(req.body||{});
    const task=requireRecord(store.get<Task>('tasks',String(req.params.id)),'Task');
    if(task.status!=='failed')throw new HttpError(409,'Only failed tasks can be retried.');
    if(!dailyRoom(store,task.kind))throw new HttpError(429,'Daily application preparation limit reached.');
    const updated=store.transaction(()=>{
      const next=store.save('tasks',{...task,status:'queued' as const,error:null,finishedAt:null,provider:input.provider||task.provider||store.meta<Settings>('settings')!.provider});
      if(task.kind==='application'&&task.jobId){const job=store.get<Job>('jobs',task.jobId);if(job&&['saved','unknown','ready'].includes(job.status))store.save('jobs',{...job,status:'preparing',updatedAt:now()});}
      return next;
    });res.status(202).json(publicTask(updated));
  });
  router.patch('/documents/:id',async(req,res)=>{
    const document=requireRecord(store.get<Document>('documents',String(req.params.id)),'Document');
    const input=z.object({content:text.min(1).max(45000).optional(),status:z.enum(['draft','needs_review','approved']).optional(),reviewChecks:z.array(z.object({flag:text.min(1).max(2000),note:text.min(12).max(2000)}).strict()).max(100).optional()}).parse(req.body);
    const content=input.content??document.content;
    const edited=content!==document.content;
    const generationFlags=document.generationFlags??document.flags;
    const hardFlags=document.kind==='brief'?[]:factualFlags(content,store.all<Evidence>('evidence'));
    if(document.kind==='cv')hardFlags.push(...(await renderPdf({...document,content})).flags);
    if(edited&&input.reviewChecks?.length)throw new HttpError(422,'Save your text changes first, then review the checks against the updated draft.');
    if(input.reviewChecks?.some(check=>!generationFlags.includes(check.flag)||!canReviewCheck(check.flag)||hardFlags.includes(check.flag)))throw new HttpError(422,'This check needs a source or content correction before it can be resolved.');
    const reviewChecks=edited?[]:input.reviewChecks?input.reviewChecks.map(check=>({...check,reviewedAt:now()})):document.reviewChecks??[];
    const resolved=new Set(reviewChecks.map(check=>check.flag));
    const flags=[...new Set([...generationFlags.filter(flag=>!resolved.has(flag)||!canReviewCheck(flag)),...hardFlags])];
    if(input.status==='approved'&&flags.length)throw new HttpError(422,`Resolve the document checks before approval: ${flags.join(' ')}`);
    const status=input.status??(edited?(flags.length?'needs_review':'draft'):flags.length?'needs_review':document.status);
    const updated:Document={...document,content,status,flags,generationFlags,reviewChecks};
    store.transaction(()=>{
      store.save('documents',updated);
      const documents=store.all<Document>('documents').filter(d=>d.jobId===document.jobId);
      const job=store.get<Job>('jobs',document.jobId);
      if(job){const needsReview=documents.some(d=>d.flags.length>0||d.status!=='approved');store.save('jobs',{...job,needsReview,status:!needsReview&&['saved','unknown','preparing'].includes(job.status)?'ready':job.status,updatedAt:now()});}
    });res.json(updated);
  });
  router.post('/documents/:id/peer-review',(req,res)=>{
    const document=requireRecord(store.get<Document>('documents',String(req.params.id)),'Document');
    if(document.content.length>16000)throw new HttpError(422,'This document is too long for a review round. Shorten a saved copy to 16,000 characters first.');
    if(store.all<Task>('tasks').filter(t=>t.kind==='practice'&&t.createdAt.startsWith(dailyKey())).length>=store.meta<Settings>('settings')!.dailyLimit)throw new HttpError(429,'Daily review limit reached.');
    const result=store.transaction(()=>{
      const practice:Practice={id:id(),jobId:document.jobId,kind:'document_review',reviewProviders:['codex','claude-code'],title:`Review: ${document.title}`,prompt:'Review this saved application document against supplied candidate evidence and role requirements. Identify factual gaps, clarity issues and unsupported claims. Never invent missing achievements.',answer:document.content,feedback:null,score:null,status:'reviewing',createdAt:now()};
      store.save('practice',practice);const task=queueTask(store,'practice',document.jobId,'codex',practice.id);task.reviewProvider='claude-code';store.save('tasks',task);return {practiceId:practice.id,task:publicTask(task)};
    });res.status(202).json(result);
  });
  router.get('/documents/:id/download',async(req,res)=>{
    const document=requireRecord(store.get<Document>('documents',String(req.params.id)),'Document');
    const format=z.enum(['pdf','md']).parse(req.query.format||'md');
    const filename=safeFilename(document.title);
    res.setHeader('Cache-Control','no-store');
    if(format==='md'){res.setHeader('Content-Disposition',`attachment; filename="${filename}.md"`);res.type('text/markdown').send(document.content);return;}
    const pdf=await renderPdf(document);
    res.setHeader('Content-Disposition',`attachment; filename="${filename}.pdf"`);res.setHeader('X-Document-Pages',String(pdf.pages));res.type('application/pdf').send(pdf.buffer);
  });
  router.post('/practice',(req,res)=>{
    const input=z.object({jobId:z.string().optional().nullable(),kind:z.enum(['behavioural','case','numerical','product','mental-maths','market-sizing','chart-reasoning']),knowledgeId:z.string().optional().nullable()}).parse(req.body);
    const job=input.jobId?requireRecord(store.get<Job>('jobs',input.jobId),'Opportunity'):undefined;
    const material=input.knowledgeId?requireRecord(store.get<KnowledgeItem>('knowledge',input.knowledgeId),'Case material'):undefined;
    if(material&&(input.kind!=='case'||material.kind!=='case'))throw new HttpError(422,'Only case-material sources can be attached to a case practice session.');
    if(material&&(material.status!=='reviewed'||!material.content.trim()))throw new HttpError(422,'Choose a reviewed case source with imported text.');
    const practice=buildPractice(input.kind,job,material);
    store.save('practice',practice);res.status(201).json(practice);
  });
  router.patch('/practice/:id/progress',(req,res)=>{
    const practice=requireRecord(store.get<Practice>('practice',String(req.params.id)),'Practice');
    const stage=z.enum(['clarify','structure','calculate','recommend']);
    const input=z.object({draftAnswer:z.string().max(16000).optional(),stage:stage.optional(),stageAnswers:z.record(stage,z.string().max(12000)).optional(),timer:z.object({mode:z.enum(['untimed','timed']),elapsedSeconds:z.number().int().min(0).max(604800)}).optional()}).parse(req.body);
    res.json(store.save('practice',{...practice,...input}));
  });
  router.post('/practice/:id/answer',(req,res)=>{
    const input=z.object({answer:text.min(20).max(16000),provider:providers.optional(),reviewProvider:providers.optional()}).parse(req.body);
    const practice=requireRecord(store.get<Practice>('practice',String(req.params.id)),'Practice');
    if(store.all<Task>('tasks').some(t=>t.practiceId===practice.id&&['queued','running'].includes(t.status)))throw new HttpError(409,'Feedback is already queued for this exercise.');
    const selectedProvider=input.provider||store.meta<Settings>('settings')!.provider;
    if(input.reviewProvider===selectedProvider)throw new HttpError(422,'Choose different providers for a second opinion.');
    const task=store.transaction(()=>{const task=queueTask(store,'practice',practice.jobId,selectedProvider,practice.id);if(input.reviewProvider){task.reviewProvider=input.reviewProvider;store.save('tasks',task);}store.save('practice',{...practice,answer:input.answer,reviewProviders:[selectedProvider,...(input.reviewProvider?[input.reviewProvider]:[])],status:'reviewing',feedback:null,score:null});return task;});
    res.status(202).json(publicTask(task));
  });
  const contactInput=z.object({name:short.min(1),company:short.optional(),role:short.optional(),email:z.union([z.email(),z.literal('')]).optional(),profileUrl:url.optional(),notes:text.max(12000).optional(),followUp:date.optional(),status:z.enum(['new','contacted','replied','meeting','closed']).optional(),...networkingFields});
  function checkContactLinks(input:{jobIds?:string[]}){for(const jobId of input.jobIds||[])requireRecord(store.get<Job>('jobs',jobId),'Linked opportunity');}
  router.post('/contacts',(req,res)=>{
    const input=contactInput.parse(req.body);checkContactLinks(input);
    const contact:Contact={id:id(),company:'',role:'',email:'',profileUrl:'',notes:'',followUp:null,status:'new',...input};
    store.save('contacts',contact);res.status(201).json(contact);
  });
  router.patch('/contacts/:id',(req,res)=>{
    const contact=requireRecord(store.get<Contact>('contacts',String(req.params.id)),'Contact');
    const input=contactInput.partial().parse(req.body);checkContactLinks(input);
    const updated={...contact,...input};
    if(outreachFingerprint(store,contact)!==outreachFingerprint(store,updated))updated.outreachDrafts=contact.outreachDrafts?.map(d=>({...d,stale:true}));
    res.json(store.save('contacts',updated));
  });
  router.post('/contacts/:id/outreach',(req,res)=>{
    const contact=requireRecord(store.get<Contact>('contacts',String(req.params.id)),'Contact');
    const input=z.object({provider:providers.optional()}).parse(req.body||{});
    if(!contact.signals?.some(s=>s.status!=='closed'))throw new HttpError(422,'Save an open hiring signal with a source, date and summary first.');
    if(!outreachContext(store,contact).evidence.length)throw new HttpError(422,'Add usable career evidence before drafting an approach.');
    if((contact.outreachDrafts?.length||0)>=20)throw new HttpError(422,'This contact has 20 saved drafts. Export and remove an older draft first.');
    if(store.all<Task>('tasks').some(t=>t.kind==='outreach'&&t.contactId===contact.id&&['queued','running'].includes(t.status)))throw new HttpError(409,'An approach is already being drafted for this person.');
    if(!dailyRoom(store,'outreach'))throw new HttpError(429,'Daily outreach drafting limit reached.');
    const task:Task={id:id(),kind:'outreach',contactId:contact.id,jobId:null,provider:input.provider||store.meta<Settings>('settings')!.provider,status:'queued',error:null,createdAt:now(),finishedAt:null,attempts:0};
    store.save('tasks',task);res.status(202).json(publicTask(task));
  });
  router.patch('/contacts/:id/outreach/:draftId',(req,res)=>{
    const contact=requireRecord(store.get<Contact>('contacts',String(req.params.id)),'Contact');
    requireRecord(contact.outreachDrafts?.find(d=>d.id===req.params.draftId),'Draft');
    const input=z.object({subject:outreachOutput.shape.subject,body:outreachOutput.shape.body,reviewed:z.boolean().optional()}).parse(req.body);
    if(input.reviewed&&contact.outreachDrafts!.find(d=>d.id===req.params.draftId)?.stale)throw new HttpError(422,'The source context changed. Prepare a fresh draft before marking it reviewed.');
    res.json(store.save('contacts',{...contact,outreachDrafts:contact.outreachDrafts!.map(d=>d.id===req.params.draftId?{...d,subject:input.subject,body:input.body,editedAt:now(),reviewedAt:input.reviewed?now():undefined}:d)}));
  });
  router.delete('/contacts/:id/outreach/:draftId',(req,res)=>{
    const contact=requireRecord(store.get<Contact>('contacts',String(req.params.id)),'Contact');
    requireRecord(contact.outreachDrafts?.find(d=>d.id===req.params.draftId),'Draft');
    res.json(store.save('contacts',{...contact,outreachDrafts:contact.outreachDrafts!.filter(d=>d.id!==req.params.draftId)}));
  });
  router.post('/learning',(req,res)=>{
    const input=z.object({title:short.min(1),skill:short.optional(),nextAction:text.max(3000).optional()}).parse(req.body);
    res.status(201).json(store.save<Learning>('learning',{id:id(),title:input.title,skill:input.skill||'',nextAction:input.nextAction||'',status:'planned',createdAt:now()}));
  });
  router.patch('/learning/:id',(req,res)=>{
    const learning=requireRecord(store.get<Learning>('learning',String(req.params.id)),'Learning item');
    const input=z.object({status:z.enum(['planned','active','done']).optional(),nextAction:text.max(3000).optional()}).parse(req.body);
    res.json(store.save('learning',{...learning,...input}));
  });
  router.post('/evidence',(req,res)=>{
    const input=z.object({category:short.min(1),text:text.min(10).max(6000),source:short.min(1),status:z.enum(['verified','user_stated','unresolved']).default('user_stated')}).parse(req.body);
    res.status(201).json(store.save<Evidence>('evidence',{id:id(),...input}));
  });
  router.patch('/evidence/:id',(req,res)=>{
    const evidence=requireRecord(store.get<Evidence>('evidence',String(req.params.id)),'Evidence');
    const input=z.object({category:short.min(1).optional(),text:text.min(10).max(6000).optional(),source:short.min(1).optional(),status:z.enum(['verified','user_stated','unresolved']).optional()}).parse(req.body);
    const updated={...evidence,...input};
    store.transaction(()=>{store.save('evidence',updated);if(JSON.stringify(updated)!==JSON.stringify(evidence))invalidateSourceDocuments(store,evidence.id,'evidence');});
    res.json(updated);
  });
  router.post('/knowledge/import/preview',async(req,res)=>{
    const input=z.object({files:z.array(z.object({name:z.string().min(1).max(500),mime:z.string().max(200).optional(),text:z.string().max(12000000).optional(),contentBase64:z.string().max(16000000).optional()})).min(1).max(30)}).parse(req.body);
    const records:Awaited<ReturnType<typeof parseKnowledgeUpload>>['records']=[];
    const warnings:string[]=[];
    for(const file of input.files){
      try{const result=await parseKnowledgeUpload(file);records.push(...result.records);warnings.push(...result.warnings);}
      catch(error){warnings.push(`${file.name}: ${error instanceof Error?error.message:'The document could not be read.'}`);}
    }
    if(records.length>500)throw new HttpError(422,'This batch contains more than 500 source parts. Import fewer files at once.');
    res.json({records,warnings});
  });
  router.post('/knowledge/import',(req,res)=>{
    const record=z.object({title:short.min(1),kind:z.enum(['document','url','chat','github','case']),url:url.default(''),content:z.string().max(50000),source:z.string().max(1000),tags:z.array(short.max(40)).max(20).default([]),status:z.string().optional()});
    const input=z.object({records:z.array(record).min(1).max(500)}).parse(req.body);let imported=0;
    store.transaction(()=>{for(const draft of input.records){if(!draft.content.trim()&&!draft.url)continue;const old=store.all<KnowledgeItem>('knowledge').find(k=>k.title===draft.title&&k.content===draft.content&&k.url===draft.url);if(old)continue;store.save<KnowledgeItem>('knowledge',{...draft,id:id(),status:'unreviewed',createdAt:now(),updatedAt:now()});imported++;}store.activity(`Imported ${imported} knowledge sources.`);});res.json({imported});
  });
  router.post('/knowledge',(req,res)=>{
    const input=z.object({title:short.min(1),kind:z.enum(['document','url','chat','github','case']),url:url.optional(),content:text.max(50000).optional(),source:short.optional(),tags:z.array(short.max(40)).max(20).optional(),status:z.enum(['unreviewed','reviewed','archived']).optional()}).parse(req.body);
    if(!input.url&&!input.content)throw new HttpError(422,'Add a source URL or paste the source text before saving it.');
    const item:KnowledgeItem={id:id(),title:input.title,kind:input.kind,url:input.url||'',content:input.content||'',source:input.source||'Added in SteVie',tags:input.tags||[],status:input.status||'unreviewed',createdAt:now(),updatedAt:now()};
    store.transaction(()=>{store.save('knowledge',item);store.activity(`Added ${item.kind} source: ${item.title}.`);});
    res.status(201).json(item);
  });
  router.patch('/knowledge/:id',(req,res)=>{
    const item=requireRecord(store.get<KnowledgeItem>('knowledge',String(req.params.id)),'Knowledge item');
    const input=z.object({title:short.min(1).optional(),kind:z.enum(['document','url','chat','github','case']).optional(),url:url.optional(),content:text.max(50000).optional(),source:short.optional(),tags:z.array(short.max(40)).max(20).optional(),status:z.enum(['unreviewed','reviewed','archived']).optional()}).parse(req.body);
    const updated={...item,...input,updatedAt:now()};
    if(!updated.url&&!updated.content)throw new HttpError(422,'A knowledge item needs a source URL or source text.');
    store.transaction(()=>{store.save('knowledge',updated);if(Object.entries(input).some(([key,value])=>JSON.stringify(item[key as keyof KnowledgeItem])!==JSON.stringify(value)))invalidateSourceDocuments(store,item.id,'knowledge');});
    res.json(updated);
  });
  router.delete('/knowledge/:id',(req,res)=>{const item=requireRecord(store.get<KnowledgeItem>('knowledge',String(req.params.id)),'Knowledge item');if(store.all<Practice>('practice').some(session=>session.knowledgeId===item.id)||store.all<Document>('documents').some(document=>document.sourceSnapshots?.some(source=>source.id===item.id)))throw new HttpError(409,'This source supports saved work. Archive it instead to retain the evidence trail.');store.database.prepare('DELETE FROM records WHERE id=? AND type=?').run(item.id,'knowledge');res.status(204).end();});
  router.post('/scouts',(req,res)=>{
    const input=z.object({kind:z.enum(['roles','people']),source:z.enum(['linkedin','linkedin_posts','jumpstart','trackr','web']),query:short.min(2),notes:text.max(12000).optional()}).parse(req.body);
    const target:ScoutTarget={id:id(),kind:input.kind,source:input.source,query:input.query,notes:input.notes||'',status:'planned',createdAt:now(),updatedAt:now()};
    store.transaction(()=>{store.save('scouts',target);store.activity(`Added a ${target.kind} scouting plan for ${target.query}.`);});
    res.status(201).json(target);
  });
  router.patch('/scouts/:id',(req,res)=>{
    const target=requireRecord(store.get<ScoutTarget>('scouts',String(req.params.id)),'Scouting plan');
    const input=z.object({notes:text.max(12000).optional(),status:z.enum(['planned','reviewing','done','paused']).optional(),query:short.min(2).optional()}).parse(req.body);
    res.json(store.save('scouts',{...target,...input,updatedAt:now()}));
  });
  router.patch('/settings',(req,res)=>{
    const input=z.object({provider:providers.optional(),jumpstartUrl:url.optional(),trackrUrl:url.optional(),linkedinUrl:url.optional(),dailyLimit:z.number().int().min(1).max(100).optional()}).parse(req.body);
    const settings={...store.meta<Settings>('settings')!,...input};store.setMeta('settings',settings);res.json(settings);
  });
  router.use((_req,res)=>res.status(404).json({error:'That API route does not exist.'}));
  router.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(error instanceof z.ZodError){res.status(400).json({error:error.issues.map(i=>`${i.path.join('.')||'Input'}: ${i.message}`).join(' ')});return;}
    if(error instanceof HttpError){res.status(error.status).json({error:error.message});return;}
    const message=error instanceof Error?error.message:'';
    if(/UNIQUE constraint failed/i.test(message)){res.status(409).json({error:'That opportunity URL or active task already exists.'});return;}
    if(error instanceof SyntaxError){res.status(400).json({error:'Invalid JSON request.'});return;}
    console.error('SteVie API error:',error instanceof Error?error.name:'Unknown error');
    res.status(500).json({error:'The request could not be completed. Your existing records have been preserved.'});
  });
  return router;
}

type WorkerDependencies={generateApplication:typeof generateApplication;coachPractice:typeof coachPractice;generateOutreach?:typeof generateOutreach};
export async function processOneTask(store:Store,dependencies:WorkerDependencies={generateApplication,coachPractice,generateOutreach},onComplete?:(event:{kind:string;jobId:string|null;text:string})=>void|Promise<void>):Promise<boolean> {
  const task=store.claimTask();if(!task)return false;
  try {
    const day=dailyKey();const old=store.meta<{date:string;count:number}>('dailyUsage');const used=old?.date===day?old.count:0;
    if(task.kind==='application'){
      if(used>=store.meta<Settings>('settings')!.dailyLimit)throw new Error('Daily application preparation limit reached. Retry tomorrow or change the limit.');
      store.setMeta('dailyUsage',{date:day,count:used+1});
    }
    const provider=task.provider||store.meta<Settings>('settings')!.provider;
    if(task.kind==='application') {
      const job=requireRecord(store.get<Job>('jobs',task.jobId||''),'Opportunity');
      const evidence=store.all<Evidence>('evidence').filter(e=>e.status!=='unresolved');
      const knowledge=retrieveKnowledge(store,`${job.company} ${job.title} ${job.description}`);
      const result=await dependencies.generateApplication({job,evidence,profile:store.meta<Profile>('profile')!,context:`${generationContext()}\n\n${knowledge.context}`,provider});
      const references=new Set(evidence.map(e=>e.id));
      assertCompletePack(result,references);
      const packFlags=[...result.flags];
      if(!result.evidenceIds.length||result.evidenceIds.some(reference=>!references.has(reference)))packFlags.push('Evidence references are missing or invalid. Check the source of every personal claim.');
      const documents:Document[]=[];
      const kinds=['cv','letter','answers','brief'] as const;
      for(const kind of kinds) {
        const content=result[kind];
        if(!content||!content.trim())throw new Error(`The provider returned an empty ${kind}. Nothing was saved. Retry after checking the provider.`);
        const flags=[...packFlags,...(kind==='brief'?[]:factualFlags(content,evidence))];
        const document:Document={id:id(),jobId:job.id,kind,title:`${job.company} - ${job.title} - ${kind==='cv'?'CV':kind==='letter'?'Cover letter':kind==='answers'?'Form answers':'Interview brief'}`,content,status:flags.length?'needs_review':'draft',createdAt:now(),provider,flags:[...new Set(flags)],generationFlags:[...new Set(packFlags)],evidenceIds:result.evidenceIds,sourceSnapshots:knowledge.sources};
        if(kind==='cv'){document.flags.push(...(await renderPdf(document)).flags);if(document.flags.length)document.status='needs_review';}
        documents.push(document);
      }
      store.transaction(()=>{
        for(const document of documents)store.save('documents',document);
        const current=store.get<Job>('jobs',job.id)!;
        const flagged=documents.some(d=>d.flags.length>0);
        store.save('jobs',{...current,fit:Math.round(Math.max(0,Math.min(100,result.fit))),fitReason:result.fitReason,needsReview:true,status:['preparing','saved','unknown','ready'].includes(current.status)?(flagged?'saved':'ready'):current.status,updatedAt:now()});
        store.save('tasks',{...task,status:'done',error:null,finishedAt:now()});
        store.activity(`Prepared four documents for ${job.company}.${flagged?' Resolve the flagged checks before approval.':' Ready for your review.'}`);
      });
      await onComplete?.({kind:task.kind,jobId:job.id,text:`Application pack ready for ${job.company}.`});
    } else if(task.kind==='scout') {
      const run=await runNativeScout(store,task,job=>dailyRoom(store)?queueTask(store,'application',job.id,task.provider!):undefined);
      store.save('tasks',{...task,status:'done',error:null,finishedAt:now()});
      if(run.created||run.status==='partial')await onComplete?.({kind:'scout',jobId:null,text:`Career scout: ${run.created} new roles, ${run.queued} draft packs queued, ${run.held} held.${run.status==='partial'?' Some feeds need attention.':''}`});
    } else if(task.kind==='outreach') {
      const contact=requireRecord(store.get<Contact>('contacts',task.contactId||''),'Contact');
      if(!contact.signals?.some(s=>s.status!=='closed'))throw new Error('No open hiring signal remains. Check this contact before retrying.');
      if((contact.outreachDrafts?.length||0)>=20)throw new Error('This contact already has 20 drafts. Remove an older draft before retrying.');
      const usage=store.meta<{date:string;count:number}>('outreachUsage');const count=usage?.date===day?usage.count:0;
      if(count>=store.meta<Settings>('settings')!.dailyLimit)throw new Error('Daily outreach drafting limit reached. Retry tomorrow.');
      store.setMeta('outreachUsage',{date:day,count:count+1});
      if(!dependencies.generateOutreach)throw new Error('Outreach drafting is not configured.');
      const context=outreachContext(store,contact),fingerprint=outreachFingerprint(store,contact);
      const result=outreachOutput.parse(await dependencies.generateOutreach({provider,context}));
      if(result.evidenceIds.some(id=>!context.evidence.some(e=>e.id===id)))throw new Error('Outreach references unknown evidence. No draft was saved.');
      const current=requireRecord(store.get<Contact>('contacts',contact.id),'Contact');
      if(outreachFingerprint(store,current)!==fingerprint)throw new Error('Supporting context changed during drafting. Retry to use the current sources.');
      const draft={...result,id:id(),provider,createdAt:now(),flags:[...new Set(['Check the source is still current and each claim is accurate before sending.',...result.flags])]};
      store.transaction(()=>{store.save('contacts',{...current,outreachDrafts:[draft,...(current.outreachDrafts||[])]});store.save('tasks',{...task,status:'done',finishedAt:now(),error:null});store.activity(`Outreach draft ready for ${current.name}. Nothing has been sent.`);});
      await onComplete?.({kind:'outreach',jobId:null,text:'An outreach draft is ready in People. Review before sending.'});
    } else if(task.kind==='practice') {
      const practice=requireRecord(store.get<Practice>('practice',task.practiceId||''),'Practice');
      const job=practice.jobId?store.get<Job>('jobs',practice.jobId):undefined;
      const knowledge=retrieveKnowledge(store,`${practice.kind} ${job?.title||''} ${practice.title}`,7000);
      const candidateEvidence=practice.kind==='document_review'?JSON.stringify(store.all<Evidence>('evidence').filter(e=>e.status!=='unresolved')):'';
      const result=await peerReview({kind:practice.kind,prompt:practice.prompt,answer:practice.answer,context:`${generationContext()}\n${job?`Target role: ${job.title} at ${job.company}.\nRole description: ${job.description.slice(0,9000)}`:''}\n${knowledge.context}\nCandidate evidence: ${candidateEvidence}`,provider},task.reviewProvider,dependencies.coachPractice,(feedback,score)=>{store.save('practice',{...store.get<Practice>('practice',practice.id)!,feedback,score,status:'reviewing'});});
    store.transaction(()=>{store.save('practice',{...store.get<Practice>('practice',practice.id)!,feedback:result.feedback,score:Math.round(Math.max(0,Math.min(100,result.score))),status:'reviewed'});store.save('tasks',{...task,status:'done',error:null,finishedAt:now()});store.activity(`Feedback ready for ${practice.title}.`);});
      await onComplete?.({kind:task.kind,jobId:task.jobId,text:'Your practice feedback is ready.'});
    } else throw new Error('This task type has no connected source yet.');
  } catch(error) {
    // AI adapters return actionable, credential-free errors. Cap stored text and redact credential shapes.
    const message=(error instanceof Error?error.message:'Task failed. Check the provider connection.').replace(/(?:sk-|Bearer\s+)[A-Za-z0-9_.-]{10,}/gi,'[redacted]').slice(0,700);
    // A push notification failure after committed work must not change a successful task into a failure.
    if(store.get<Task>('tasks',task.id)?.status==='done'){store.activity('Work completed, but its notification could not be delivered.');return true;}
    store.transaction(()=>{
      store.save('tasks',{...task,status:'failed',error:message,finishedAt:now()});
      if(task.kind==='application'&&task.jobId){const job=store.get<Job>('jobs',task.jobId);if(job)store.save('jobs',{...job,status:job.status==='preparing'?'saved':job.status,needsReview:true,updatedAt:now()});}
      if(task.kind==='practice'&&task.practiceId){const practice=store.get<Practice>('practice',task.practiceId);if(practice)store.save('practice',{...practice,status:'failed'});}
      store.activity(`${task.kind==='application'?'Application preparation':task.kind==='scout'?'Career scouting':task.kind==='outreach'?'Outreach drafting':'Practice review'} needs attention: ${message}`);
    });
    try{await onComplete?.({kind:'failure',jobId:task.jobId,text:`${task.kind==='scout'?'Career scouting':'Preparation'} needs attention: ${message}`});}catch{store.activity('Failure notification could not be delivered.');}
  }
  return true;
}
let activeStop:(()=>void)|undefined;
export function startWorker(options:{store?:Store;onComplete?:(event:{kind:string;jobId:string|null;text:string})=>void|Promise<void>;intervalMs?:number}={}):()=>void {
  activeStop?.();
  const store=options.store||getStore();quarantineIncompleteHistory(store);store.recoverTasks();let busy=false;let stopped=false;
  const tick=async()=>{if(busy||stopped)return;busy=true;try{try{queueScout(store);}catch{/* Invalid configuration/cap cannot stop the preparation queue. */}await processOneTask(store,undefined,options.onComplete);}catch{console.error('Worker could not claim a task. It will retry.');}finally{busy=false;}};
  const timer=setInterval(()=>void tick(),options.intervalMs||1500);timer.unref();void tick();
  const stop=()=>{stopped=true;clearInterval(timer);};activeStop=stop;return stop;
}
export function stopWorker():void {activeStop?.();activeStop=undefined;}
