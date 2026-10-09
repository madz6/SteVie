import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import { createStore, id, now, type Job, type Task, type Evidence, type Document, type Settings, type Practice, type KnowledgeItem, type ScoutTarget, type Integration, type Profile } from '../server/db.js';
import { createApi, processOneTask, buildPractice } from '../server/api.js';
import { factualFlags, renderPdf } from '../server/documents.js';
import { generationContext, importInitialData, loadPrivateSeed, privateDocumentFlags } from '../server/import.js';

function job(overrides:Partial<Job>={}):Job {return {id:id(),company:'Example employer',title:'Graduate analyst',location:'Dublin',source:'Test fixture',url:'',status:'saved',deadline:null,description:'We seek a graduate analyst to research commercial problems, assess evidence and develop clear recommendations for clients.',notes:'',fit:null,fitReason:'',createdAt:now(),updatedAt:now(),needsReview:false,...overrides};}
function task(jobId:string|null,overrides:Partial<Task>={}):Task {return {id:id(),kind:'application',jobId,status:'queued',error:null,createdAt:now(),finishedAt:null,provider:'codex',attempts:0,...overrides};}
function evidence():Evidence {return {id:id(),category:'Education',text:'Northbridge College BA Business Studies. Built a survey with 82 valid responses and projected 6.4% uplift.',source:'Fictional test fixture',status:'verified'};}

test('SQLite persists records and recovers one interrupted task without creating duplicates',()=>{
  const folder=mkdtempSync(join(tmpdir(),'stevie-test-'));
  const path=join(folder,'isolated.db');
  try {
    let store=createStore(path,false);const role=job();store.save('jobs',role);const pending=task(role.id,{status:'running',attempts:1});store.save('tasks',pending);store.close();
    store=createStore(path,false);store.recoverTasks();assert.equal(store.get<Job>('jobs',role.id)?.company,role.company);assert.equal(store.all<Task>('tasks').length,1);assert.equal(store.get<Task>('tasks',pending.id)?.status,'queued');
    assert.equal(store.claimTask()?.status,'running');assert.equal(store.claimTask(),undefined);
    store.recoverTasks();assert.equal(store.get<Task>('tasks',pending.id)?.status,'failed');store.close();
  }finally{rmSync(folder,{recursive:true,force:true});}
});

test('application worker creates four real documents atomically, cites evidence, and preserves an applied status',async()=>{
  const store=createStore(':memory:',false);const role=job({status:'applied'});const fact=evidence();store.save('jobs',role);store.save('evidence',fact);const pending=task(role.id);store.save('tasks',pending);
  const cv='# Example Candidate\n\n## Education\nNorthbridge College BA Business Studies\n- Designed a survey with 82 valid responses.';
  let calls=0;
  const generated={cv,letter:'Dear hiring team,\nI studied Business Studies and developed a survey-led research project.\nExample Candidate',answers:'I use evidence to structure an ambiguous problem.',brief:'Ask about client project ownership.',fit:74,fitReason:'Research evidence supports the role.',evidenceIds:[fact.id],flags:[]};
  await processOneTask(store,{generateApplication:async(input)=>{calls++;assert.equal(input.evidence.length,1);assert.ok(!input.context.includes('journal.txt'));return generated;},coachPractice:async()=>{throw new Error('Unexpected coaching call');}});
  assert.equal(calls,1);assert.equal(store.all<Document>('documents').length,4);assert.equal(store.get<Task>('tasks',pending.id)?.status,'done');assert.equal(store.get<Job>('jobs',role.id)?.status,'applied');
  assert.equal(await processOneTask(store,{generateApplication:async()=>{throw new Error('Must not call again');},coachPractice:async()=>{throw new Error('Must not call again');}}),false);
  const cvDocument=store.all<Document>('documents').find(d=>d.kind==='cv')!;const pdf=await renderPdf(cvDocument);assert.equal(pdf.pages,1);assert.equal(pdf.buffer.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.buffer.length>1000);store.close();
});

test('unsupported claims and invalid evidence references keep generated documents out of ready',async()=>{
  const store=createStore(':memory:',false);const role=job({status:'preparing'});store.save('jobs',role);store.save('evidence',evidence());store.save('tasks',task(role.id));
  await processOneTask(store,{generateApplication:async()=>({cv:'# Example Candidate\nSkills: ForecastKit.\nAchieved 18.6% revenue growth.',letter:'I delivered 41% time savings.',answers:'I built a system used by 999 customers.',brief:'Review the employer.',fit:95,fitReason:'Fit estimate',evidenceIds:['invented-id'],flags:[]}),coachPractice:async()=>({feedback:'',score:0})});
  assert.equal(store.get<Job>('jobs',role.id)?.status,'saved');assert.equal(store.get<Job>('jobs',role.id)?.needsReview,true);assert.ok(store.all<Document>('documents').every(d=>d.flags.length>0&&d.status==='needs_review'));store.close();
});

test('provider failure leaves no partial application, stores an actionable redacted error, and can be retried',async()=>{
  const store=createStore(':memory:',false);const role=job({status:'preparing'});store.save('jobs',role);const pending=task(role.id);store.save('tasks',pending);
  await processOneTask(store,{generateApplication:async()=>{throw new Error('Sign in again; token sk-abcdefghijklmnop must not leak');},coachPractice:async()=>({feedback:'',score:0})});
  const failed=store.get<Task>('tasks',pending.id)!;assert.equal(failed.status,'failed');assert.match(failed.error!,/Sign in again/);assert.ok(!failed.error!.includes('sk-'));assert.equal(store.all('documents').length,0);assert.equal(store.get<Job>('jobs',role.id)?.status,'saved');store.close();
});

test('coaching writes durable feedback to the requested practice and notifications cannot undo completed work',async()=>{
  const store=createStore(':memory:',false);const practice=buildPractice('numerical');practice.answer='I calculate the weighted handling time, convert to hours, then divide by productive hours and round up.';store.save('practice',practice);const pending=task(null,{kind:'practice',practiceId:practice.id});store.save('tasks',pending);
  await processOneTask(store,{generateApplication:async()=>{throw new Error('Unexpected application call');},coachPractice:async input=>{assert.match(input.prompt,/1,200 cases/);return {feedback:'Correct structure. Finish the arithmetic and include the staffing constraint.',score:62};}},()=>{throw new Error('Push unavailable');});
  assert.equal(store.get<Task>('tasks',pending.id)?.status,'done');assert.equal(store.get<Practice>('practice',practice.id)?.score,62);store.close();
});

test('PDF export flags overflow and preserves all pages instead of silently truncating',async()=>{
  const content='# Long CV\n\n'+Array.from({length:160},(_,i)=>`- Evidence paragraph ${i+1}: This line explains specific work and its evidenced result without removing content.`).join('\n')+'\nEND OF DOCUMENT';
  const result=await renderPdf({content,title:'Overflow fixture',kind:'cv'});assert.ok(result.pages>1);assert.match(result.flags.join(' '),/all text has been preserved/);assert.ok(result.buffer.length>3000);
});

test('generic factual checks reject placeholders and unsupported numbers without inheriting candidate rules',()=>{
  assert.equal(factualFlags('I designed a survey with 82 valid responses.',[evidence()],null).length,0);
  assert.ok(factualFlags('I served 999 customers.',[evidence()],null).some(flag=>flag.includes('999')));
  assert.ok(factualFlags('I achieved [insert metric].',[evidence()],null).some(flag=>flag.includes('placeholder')));
});

test('API validates dates, deduplicates URLs, prevents duplicate work and enforces daily cap',async()=>{
  const store=createStore(':memory:',false);const app=express();app.use('/api',createApi({store}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}/api`;
  const post=(path:string,body:unknown)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    assert.equal((await post('/jobs',{company:'A',title:'B',deadline:'2026-99-31'})).status,400);
    assert.equal((await post('/jobs',{company:'A',title:'B',url:'javascript:alert(1)'})).status,400);
    const response=await post('/jobs',{company:'Example',title:'Analyst',url:'https://example.com/jobs/1?utm_source=test',description:job().description});assert.equal(response.status,201);const role=await response.json() as Job;
    assert.equal((await post('/jobs',{company:'Example',title:'Analyst',url:'https://example.com/jobs/1'})).status,409);
    assert.equal((await post(`/jobs/${role.id}/prepare`,{})).status,202);
    assert.equal((await post(`/jobs/${role.id}/prepare`,{})).status,409);
    store.setMeta('settings',{...store.meta<Settings>('settings')!,dailyLimit:1});
    const next=store.save('jobs',job());assert.equal((await post(`/jobs/${next.id}/prepare`,{})).status,429);
    const empty=store.save('jobs',job({description:''}));assert.equal((await post(`/jobs/${empty.id}/prepare`,{})).status,422);
    assert.equal((await post('/practice',{kind:'made-up'})).status,400);
    const contactResponse=await post('/contacts',{name:'Recruiter',company:'Example',followUp:'2026-10-08'});assert.equal(contactResponse.status,201);
    const learning=await post('/learning',{title:'Practise chart selection',skill:'Numerical reasoning',nextAction:'Explain one chart in 60 seconds'});assert.equal(learning.status,201);
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));store.close();}
});

test('fresh public installs have no candidate profile, evidence, historical jobs or personalised PDF author',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'stevie-empty-seed-'));
  const missingSeed=join(folder,'private-seed.json');
  const store=createStore(':memory:',true,missingSeed);
  try {
    assert.deepEqual(store.meta<Profile>('profile'),{name:'',headline:'',location:''});
    assert.equal(store.all<Job>('jobs').length,0);assert.equal(store.all<Evidence>('evidence').length,0);assert.equal(store.all('activity').length,0);
    assert.equal(store.meta<Settings>('settings')?.provider,'codex');
    assert.match(generationContext(missingSeed),/Facts come only from supplied evidence/);
    assert.doesNotMatch(generationContext(missingSeed),/Local candidate instructions:/);
    const pdf=await renderPdf({kind:'cv',title:'Public fixture',content:'Example CV'},missingSeed);
    if(!process.env.STEVIE_PROFILE_NAME)assert.doesNotMatch(pdf.buffer.toString('latin1'),/\/Author\b/);
  }finally{store.close();rmSync(folder,{recursive:true,force:true});}
});

test('explicit private seed import is idempotent and preserves existing records and profile on reopen',()=>{
  const folder=mkdtempSync(join(tmpdir(),'stevie-private-seed-'));
  const seedPath=join(folder,'private-seed.json');const dbPath=join(folder,'workspace.db');
  const fact=evidence();const first=job({company:'Fictional Acorn Labs',status:'unknown',needsReview:true});const second=job({company:first.company,title:'Product trainee',status:'rejected',needsReview:true});
  const seed={schemaVersion:1,profile:{name:'Example Candidate',headline:'Business graduate',location:'Example City'},generationInstructions:'Use short paragraphs. Never claim ForecastKit proficiency.',jobs:[first,second],evidence:[fact]};
  writeFileSync(seedPath,JSON.stringify(seed));
  let store=createStore(dbPath,true,seedPath);
  try {
    assert.equal(store.all<Job>('jobs').length,2);assert.equal(store.get<Job>('jobs',first.id)?.status,'unknown');assert.equal(store.get<Job>('jobs',second.id)?.status,'rejected');
    assert.ok(store.all<Job>('jobs').every(role=>role.fit===null&&role.needsReview));
    assert.equal(store.all<Evidence>('evidence').length,1);assert.equal(store.meta<Profile>('profile')?.name,'Example Candidate');
    assert.match(generationContext(seedPath),/Never claim ForecastKit proficiency/);
    importInitialData(store,seedPath);assert.equal(store.all<Job>('jobs').length,2);assert.equal(store.all<Evidence>('evidence').length,1);assert.equal(store.all('activity').length,1);
    store.save('jobs',{...first,status:'applied'});store.save('evidence',{...fact,text:'User-edited fictional evidence.'});store.setMeta('profile',{name:'Edited Candidate',headline:'Edited headline',location:'Edited city'});
    store.close();store=createStore(dbPath,true,seedPath);
    assert.equal(store.get<Job>('jobs',first.id)?.status,'applied');assert.equal(store.get<Evidence>('evidence',fact.id)?.text,'User-edited fictional evidence.');assert.equal(store.meta<Profile>('profile')?.name,'Edited Candidate');
    importInitialData(store,seedPath);assert.equal(store.get<Job>('jobs',first.id)?.status,'applied');assert.equal(store.meta<Profile>('profile')?.name,'Edited Candidate');
  }finally{store.close();rmSync(folder,{recursive:true,force:true});}
});

test('private candidate validation and rendering metadata load only from the configured seed',async()=>{
  const folder=mkdtempSync(join(tmpdir(),'stevie-private-rules-'));const seedPath=join(folder,'private-seed.json');
  const rules=[{pattern:'ForecastKit',scope:'positive',audience:'document',message:'This fictional skill is not confirmed.'},{pattern:'achieved.{0,45}6\\.4\\s*%',scope:'positive',message:'The fictional uplift was projected.'},{pattern:'LegacyTool',scope:'all',audience:'provider',message:'Confirm the fictional provider-only claim.'}];
  writeFileSync(seedPath,JSON.stringify({schemaVersion:1,documentAuthor:'Example Author',documentRules:rules}));
  try {
    assert.ok(factualFlags('I have ForecastKit experience.',[evidence()],seedPath).some(flag=>flag.includes('not confirmed')));
    assert.equal(factualFlags('I do not have ForecastKit experience.',[evidence()],seedPath).length,0);
    assert.ok(factualFlags('I achieved a 6.4% revenue uplift.',[evidence()],seedPath).some(flag=>flag.includes('projected')));
    assert.equal(factualFlags('I have ForecastKit experience.',[evidence()],null).length,0);
    assert.deepEqual(privateDocumentFlags('LegacyTool',seedPath,'provider'),['Confirm the fictional provider-only claim.']);assert.deepEqual(privateDocumentFlags('LegacyTool',seedPath),[]);
    const anonymousCv=await renderPdf({kind:'cv',title:'Anonymous CV',content:'Fictional anonymous CV.'},seedPath);
    assert.doesNotMatch(anonymousCv.buffer.toString('latin1'),/\/Author\b/);
    const pdf=await renderPdf({kind:'letter',title:'Author fixture',content:'Fictional letter.'},seedPath);
    if(!process.env.STEVIE_PROFILE_NAME)assert.match(pdf.buffer.toString('latin1'),/\/Author\s+\d+\s+0\s+R[\s\S]*\(Example Author\)|\(Example Author\)[\s\S]*\/Author\s+\d+\s+0\s+R/);
    writeFileSync(seedPath,JSON.stringify({schemaVersion:1,documentRules:[{pattern:'[',message:'Broken rule'}]}));
    assert.throws(()=>loadPrivateSeed(seedPath),/local private seed is invalid/);
  }finally{rmSync(folder,{recursive:true,force:true});}
});

test('knowledge sources and scouting plans persist with honest external boundaries',async()=>{
  const store=createStore(':memory:',false);const app=express();app.use('/api',createApi({store}));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');const base=`http://127.0.0.1:${address.port}/api`;
  const post=(path:string,body:unknown)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    const source=await post('/knowledge',{title:'Case notes',kind:'case',source:'User import',content:'A market-sizing case framework.'});assert.equal(source.status,201);const saved=await source.json() as KnowledgeItem;assert.equal(saved.status,'unreviewed');
    const chat=await post('/knowledge',{title:'Previous chat',kind:'chat',url:'https://chatgpt.com/share/example'});assert.equal(chat.status,201);
    const scout=await post('/scouts',{kind:'people',source:'linkedin',query:'Dublin product operators',notes:'Save only people with a useful shared connection.'});assert.equal(scout.status,201);const target=await scout.json() as ScoutTarget;assert.equal(target.status,'planned');
    const bootstrap=await fetch(base+'/bootstrap').then(response=>response.json()) as {knowledge:KnowledgeItem[];scouts:ScoutTarget[];integrations:Integration[]};
    assert.equal(bootstrap.knowledge.length,2);assert.equal(bootstrap.scouts.length,1);assert.equal(bootstrap.integrations.find(item=>item.id==='linkedin')?.status,'setup_required');
  }finally{await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));store.close();}
});
