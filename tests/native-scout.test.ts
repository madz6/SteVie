import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,id,now,type Job,type Task,type Settings} from '../server/db.js';
import {defaultConfig,dueSlot,queueScout,runNativeScout} from '../server/nativeScout.js';
import {feedUrl,parseFeed,shortlistMatch,type Posting,type Feed} from '../server/scoutFeeds.js';
import {assertCompletePack,quarantineIncompleteHistory} from '../server/packValidation.js';
const feed={company:'Fixture',kind:'greenhouse' as const,board:'fixture',enabled:true};
const posting:Posting={key:'test',company:'Fixture',title:'Graduate Analyst',location:'Dublin',url:'https://example.com/jobs/test',description:'A fictional recent-graduate role analysing operational data and presenting findings to colleagues. No real vacancy.',employmentType:'unknown'};
function setup(){const store=createStore(':memory:',false);store.setMeta('scoutingPreferences',{roles:['Analyst'],locations:['Dublin'],notes:''});store.setMeta('settings',{...store.meta<Settings>('settings')!,provider:'claude-code'});store.setMeta('nativeScoutConfig',{...defaultConfig,enabled:true,feeds:[feed]});return store;}
test('Dublin scheduler follows DST, catches up only latest slot and persists its claim',()=>{
  const config={...defaultConfig,enabled:true};
  assert.equal(dueSlot(config,new Date('2026-10-10T08:00:00Z')),'2026-10-10T09:00');
  assert.equal(dueSlot(config,new Date('2026-11-10T08:59:00Z')),undefined);
  assert.equal(dueSlot(config,new Date('2026-11-10T19:05:00Z')),'2026-11-10T19:00');
  const store=setup();try{const task=queueScout(store,false,new Date('2026-10-10T18:05:00Z'))!;assert.equal(task.provider,'claude-code');assert.equal(queueScout(store,true),undefined);store.save('tasks',{...task,status:'done'});assert.equal(queueScout(store,false,new Date('2026-10-10T18:20:00Z')),undefined);store.setMeta('nativeScoutConfig',{...config,enabled:false});assert.equal(queueScout(store,false,new Date('2026-10-11T18:05:00Z')),undefined);}finally{store.close();}
});
test('feeds use fixed vendor origins, reject unsafe URLs, decode text and filter income/seniority/location',()=>{
  assert.throws(()=>feedUrl({...feed,board:'../localhost'}));
  const rows=parseFeed(feed,{jobs:[{id:1,title:'Graduate Analyst',location:{name:'Dublin'},absolute_url:'https://example.com/1',content:'&lt;p&gt;'+posting.description+'&lt;/p&gt;'}, {id:2,title:'Bad link',location:{name:'Dublin'},absolute_url:'javascript:bad()',content:posting.description}]});
  assert.equal(rows.length,1);assert.equal(rows[0].description,posting.description);
  assert.equal(shortlistMatch(posting,['Dublin'],['analyst']),true);
  assert.equal(shortlistMatch({...posting,title:'Senior Analyst'},['Dublin'],['analyst']),false);
  assert.equal(shortlistMatch({...posting,location:'Remote worldwide'},['Dublin'],['analyst']),false);
  assert.equal(shortlistMatch({...posting,title:'Retail Sales Consultant'},['Dublin'],['consultant']),false);
});
test('native scout records partial coverage, imports only exact assessed postings and suppresses repeat spend',async()=>{
  const store=setup();try{
    store.setMeta('nativeScoutConfig',{...defaultConfig,enabled:true,feeds:[feed,{...feed,board:'broken',company:'Broken'}]});
    const task=queueScout(store,true)!;let calls=0;
    const deps={fetchFeed:async(f:Feed)=>{if(f.board==='broken')throw new Error('Network');return [posting];},assessScout:async()=>{calls++;return [{key:posting.key,eligibility:'eligible' as const,reason:'Fictional confirmed requirements match.'}];}};
    const enqueue=(job:Job)=>store.save<Task>('tasks',{id:id(),jobId:job.id,kind:'application',provider:task.provider,status:'queued',error:null,createdAt:now(),finishedAt:null});
    const first=await runNativeScout(store,task,enqueue,deps);assert.equal(first.status,'partial');assert.equal(first.created,1);assert.equal(first.queued,1);
    assert.equal(store.all<Task>('tasks').find(t=>t.kind==='application')?.provider,'claude-code');
    const second=await runNativeScout(store,task,enqueue,deps);assert.equal(second.created,0);assert.equal(calls,1);
    assert.equal(store.all('jobs').length,1);
  }finally{store.close();}
});
test('provider failures retain source diagnostics and write no jobs or completed documents',async()=>{
  const store=setup();try{const task=queueScout(store,true)!;await assert.rejects(runNativeScout(store,task,()=>undefined,{fetchFeed:async()=>[posting],assessScout:async()=>{throw new Error('Provider unavailable');}}),/Provider unavailable/);assert.equal(store.all('jobs').length,0);assert.equal(store.meta<{status:string}>('nativeScoutRun')?.status,'failed');}finally{store.close();}
});
test('placeholder and invented-reference packs are rejected as incomplete, not completed drafts',()=>{
  const text='This is a fictional full-length document used to check that all four outputs are complete before saving.';
  const good={cv:text,letter:text,answers:text,brief:text,evidenceIds:['known'],flags:[]};
  assert.doesNotThrow(()=>assertCompletePack(good,new Set(['known'])));
  for(const kind of ['cv','letter','answers','brief'])assert.throws(()=>assertCompletePack({...good,[kind]:'placeholder'},new Set(['known'])),/Incomplete/);
  assert.throws(()=>assertCompletePack({...good,evidenceIds:['invented']},new Set(['known'])),/invalid evidence/);
});

test('historical placeholder packs lose their done label without deleting source documents',()=>{
 const store=setup();try{
  const stamp=now();const task:Task={id:id(),jobId:'role',kind:'application',status:'done',provider:'claude-code',error:null,createdAt:stamp,finishedAt:stamp};store.save('tasks',task);
  store.save('documents',{id:'doc',jobId:'role',kind:'letter',title:'Broken',content:'placeholder',status:'draft',createdAt:stamp,provider:'claude-code',flags:[]});
  quarantineIncompleteHistory(store);assert.equal(store.get<Task>('tasks',task.id)?.status,'failed');assert.equal(store.all('documents').length,1);assert.equal(store.all<any>('documents')[0].status,'needs_review');
  quarantineIncompleteHistory(store);assert.equal(store.all('activity').length,1);
  store.save('tasks',{...task,status:'done'});quarantineIncompleteHistory(store);assert.equal(store.get<Task>('tasks',task.id)?.status,'done');
 }finally{store.close();}
});
