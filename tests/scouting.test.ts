import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore,id,now,type Job,type Task} from '../server/db.js';
import {importScouting} from '../server/scouting.js';
import {trackFor,employmentFor} from '../src/jobTracks.js';
const role={company:'Fixture Consulting',title:'Graduate Analyst',location:'Dublin',url:'https://example.com/jobs/analyst',description:'Work with clients to analyse business processes and communicate recommendations. Applicants need analytical and communication skills.',eligibility:'eligible',eligibilityNotes:'Fictional eligible fixture',employmentType:'full_time'};
test('career purpose is separate from hours and explicit user classification wins',()=>{
  assert.equal(trackFor({title:'Part-time Data Analyst'}),'career');
  assert.equal(employmentFor({title:'Part-time Data Analyst'}),'part_time');
  assert.equal(trackFor({title:'Retail Sales Consultant'}),'income');
  assert.equal(trackFor({title:'Retail Sales Consultant',track:'career'}),'career');
  assert.equal(trackFor({title:'An unclear opportunity'}),'unclassified');
});
test('scouting deduplicates roles, skips income and ineligible roles and queues only eligible drafts',()=>{
  const store=createStore(':memory:',false);
  const enqueue=(job:Job)=>store.save<Task>('tasks',{id:id(),kind:'application',jobId:job.id,status:'queued',error:null,createdAt:now(),finishedAt:null,provider:'codex'});
  try{
    const batch={checkedAt:now(),queries:['Fixture'],roles:[role,{...role,url:role.url+'?utm_source=feed'},{...role,title:'Retail Sales Consultant',url:role.url+'2'},{...role,title:'Senior Analyst',eligibility:'ineligible',url:role.url+'3'},{...role,title:'Product Analyst',eligibility:'uncertain',url:role.url+'4'}]};
    const result=importScouting(store,batch,enqueue);
    assert.deepEqual([result.created,result.queued,result.held,result.skipped],[2,1,1,3]);
    assert.equal(store.all<Job>('jobs').find(j=>j.title==='Product Analyst')?.status,'saved');
    assert.equal(importScouting(store,batch,enqueue).created,0);
    assert.equal(store.all('tasks').length,1);
  }finally{store.close();}
});
test('quota holds keep the researched role without marking a CV complete; invalid batches write nothing',()=>{
  const store=createStore(':memory:',false);
  try{
    assert.throws(()=>importScouting(store,{checkedAt:now(),queries:['test'],roles:[role,{...role,description:'too short'}]},()=>undefined));
    assert.equal(store.all('jobs').length,0);
    assert.throws(()=>importScouting(store,{checkedAt:'2020-01-01T00:00:00.000Z',queries:['test'],roles:[role]},()=>undefined));
    const result=importScouting(store,{checkedAt:now(),queries:['test'],roles:[role]},()=>undefined);
    assert.equal(result.held,1);assert.equal(result.queued,0);assert.equal(store.all<Job>('jobs')[0].status,'saved');
  }finally{store.close();}
});

test('scouting retains verified deadlines and tolerates malformed historical URLs',()=>{
  const store=createStore(':memory:',false);
  try{
    store.save<Job>('jobs',{id:id(),company:'Old fixture',title:'Old role',location:'',url:'legacy malformed link',description:'',source:'Fixture',status:'saved',deadline:null,notes:'',needsReview:true,fit:null,fitReason:'',createdAt:now(),updatedAt:now()});
    assert.throws(()=>importScouting(store,{checkedAt:now(),queries:['fixture'],roles:[{...role,deadline:'2026-02-30'}]},()=>undefined));
    const result=importScouting(store,{checkedAt:now(),queries:['fixture'],roles:[{...role,deadline:'2026-10-19'}]},()=>undefined);
    assert.equal(store.get<Job>('jobs',result.jobIds[0])?.deadline,'2026-10-19');
  }finally{store.close();}
});
