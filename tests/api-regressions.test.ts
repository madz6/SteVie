import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createApi, processOneTask } from '../server/api.js';
import { createStore, id, now, type Document, type Job, type KnowledgeItem, type Practice, type Settings, type Task } from '../server/db.js';
import { buildPractice } from '../server/practice.js';

async function fixture() {
  const store=createStore(':memory:',false);
  const app=express();app.use('/api',createApi({store}));
  const server=app.listen(0,'127.0.0.1');
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('No test port');
  const request=(path:string,body:unknown,method='POST')=>fetch(`http://127.0.0.1:${address.port}/api${path}`,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  return {store,request,close:()=>{server.closeAllConnections();server.close();store.close();}};
}

test('retry keeps the originally selected provider even when workspace default changes',async()=>{
  const f=await fixture();try{
    const task:Task={id:id(),kind:'practice',jobId:null,status:'failed',provider:'codex',error:'Temporary outage',createdAt:now(),finishedAt:now()};
    f.store.save('tasks',task);
    f.store.setMeta('settings',{...f.store.meta<Settings>('settings')!,provider:'anthropic'});
    assert.equal((await f.request(`/tasks/${task.id}/retry`,{})).status,202);
    assert.equal(f.store.get<Task>('tasks',task.id)?.provider,'codex');
  }finally{f.close();}
});

test('coaching completion preserves draft edits made while the provider was running',async()=>{
  const store=createStore(':memory:',false);
  try{
    const practice={...buildPractice('case'),answer:'The submitted answer is the earlier version.',status:'reviewing'};
    store.save('practice',practice);
    store.save<Task>('tasks',{id:id(),kind:'practice',practiceId:practice.id,jobId:null,status:'queued',provider:'codex',error:null,createdAt:now(),finishedAt:null});
    await processOneTask(store,{generateApplication:async()=>{throw new Error('Wrong task');},coachPractice:async()=>{
      store.save('practice',{...store.get<Practice>('practice',practice.id)!,draftAnswer:'A newer draft should survive.',stageAnswers:{clarify:'New notes',structure:'',calculate:'',recommend:''}});
      return {feedback:'Feedback on the submitted answer.',score:65};
    }});
    assert.equal(store.get<Practice>('practice',practice.id)?.draftAnswer,'A newer draft should survive.');
    assert.equal(store.get<Practice>('practice',practice.id)?.stageAnswers?.clarify,'New notes');
    assert.equal(store.get<Practice>('practice',practice.id)?.answer,practice.answer);
  }finally{store.close();}
});

test('case creation rejects unreviewed material and draft saving preserves exact whitespace',async()=>{
  const f=await fixture();try{
    const item:KnowledgeItem={id:id(),title:'Fictional case',kind:'case',content:'Decide whether to expand the fictional service.',source:'Fixture',url:'',tags:[],status:'unreviewed',createdAt:now(),updatedAt:now()};
    f.store.save('knowledge',item);
    assert.equal((await f.request('/practice',{kind:'case',knowledgeId:item.id})).status,422);
    f.store.save('knowledge',{...item,status:'reviewed'});
    const response=await f.request('/practice',{kind:'case',knowledgeId:item.id});
    assert.equal(response.status,201);const practice=await response.json() as Practice;
    assert.equal((await f.request(`/practice/${practice.id}/progress`,{draftAnswer:'  Working notes\n'},'PATCH')).status,200);
    assert.equal(f.store.get<Practice>('practice',practice.id)?.draftAnswer,'  Working notes\n');
  }finally{f.close();}
});

test('one invalid knowledge file does not discard valid files in the same preview',async()=>{
  const f=await fixture();try{
    const response=await f.request('/knowledge/import/preview',{files:[{name:'valid.md',text:'Fictional reference material with a usable conclusion.'},{name:'invalid.json',text:'{broken JSON'}]});
    assert.equal(response.status,200);
    const preview=await response.json() as {records:unknown[];warnings:string[]};
    assert.equal(preview.records.length,1);assert.ok(preview.warnings.some(w=>w.includes('invalid.json')));
  }finally{f.close();}
});

test('changing a supporting source invalidates approval and referenced sources cannot be deleted',async()=>{
  const f=await fixture();try{
    const source:KnowledgeItem={id:id(),title:'Fictional source',kind:'case',content:'Original teaching material.',url:'',source:'Fixture',tags:[],status:'reviewed',createdAt:now(),updatedAt:now()};
    f.store.save('knowledge',source);
    const job:Job={id:id(),company:'Example',title:'Analyst',location:'',source:'Fixture',url:'',status:'ready',deadline:null,description:'',notes:'',fit:null,fitReason:'',createdAt:now(),updatedAt:now(),needsReview:false};f.store.save('jobs',job);
    const document:Document={id:id(),jobId:job.id,kind:'brief',title:'Example brief',content:'A factual brief for review.',status:'approved',createdAt:now(),provider:'codex',flags:[],generationFlags:[],sourceSnapshots:[{id:source.id,title:source.title,source:source.source,url:'',updatedAt:source.updatedAt,excerpt:source.content}]};f.store.save('documents',document);
    assert.equal((await f.request(`/knowledge/${source.id}`,{content:'Updated teaching material.'},'PATCH')).status,200);
    const changed=f.store.get<Document>('documents',document.id)!;assert.equal(changed.status,'needs_review');assert.ok(changed.flags.some(flag=>flag.includes('Supporting source changed')));
    assert.equal(changed.sourceSnapshots?.[0].excerpt,source.content);
    assert.equal((await f.request(`/documents/${document.id}`,{status:'approved'},'PATCH')).status,422);
    assert.equal((await f.request(`/knowledge/${source.id}`,{},'DELETE')).status,409);
  }finally{f.close();}
});
