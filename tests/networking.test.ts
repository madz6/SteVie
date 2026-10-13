import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createApi,processOneTask} from '../server/api.js';
import {createStore,type Contact,type Task,type Settings} from '../server/db.js';
import {type OutreachInput,outreachContext} from '../server/networking.js';

async function fixture(){
  const store=createStore(':memory:',false);
  store.save('evidence',{id:'ev',category:'Project',text:'Analysed fictional customer data.',source:'Fixture',status:'user_stated'});
  store.save('evidence',{id:'private',category:'Contact details',text:'Private fixture address',source:'Fixture',status:'verified'});
  store.save('evidence',{id:'uncertain',category:'Project',text:'Unsupported result',source:'Fixture',status:'unresolved'});
  const app=express();app.use('/api',createApi({store}));const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.once('listening',r));const a=server.address();assert.ok(a&&typeof a!=='string');
  const request=(path:string,body:unknown={},method='POST')=>fetch(`http://127.0.0.1:${a.port}/api${path}`,{method,headers:{'content-type':'application/json'},body:method==='GET'?undefined:JSON.stringify(body)});
  const contact=await request('/contacts',{name:'Fictional Founder',company:'Fixture Company',signals:[{id:'sig',url:'https://example.invalid/post',observedOn:'2026-10-13',summary:'A founder described plans for a small analytics team.',status:'unconfirmed'}]}).then(r=>r.json()) as Contact;
  return {store,request,contact,close:()=>{server.closeAllConnections();server.close();store.close();}};
}
const output={subject:'A question about your team',body:'Hello, I saw the team announcement. I analysed customer data in a project. Do you expect any analyst openings?',flags:['Confirm the source is current.'],evidenceIds:['ev']};
const unused={generateApplication:async()=>{throw new Error('Wrong work type');},coachPractice:async()=>{throw new Error('Wrong work type');}};

test('contact links and source dates validate; profile fields are editable',async()=>{
  const f=await fixture();try{
    assert.equal((await f.request(`/contacts/${f.contact.id}`,{jobIds:['missing']},'PATCH')).status,404);
    assert.equal((await f.request(`/contacts/${f.contact.id}`,{signals:[{...f.contact.signals![0],observedOn:'2026-02-30'}]},'PATCH')).status,400);
    assert.equal((await f.request(`/contacts/${f.contact.id}`,{signals:[{...f.contact.signals![0],url:'javascript:alert(1)'}]},'PATCH')).status,400);
    assert.equal((await f.request(`/contacts/${f.contact.id}`,{name:'Updated Person',role:'Founder',status:'replied'},'PATCH')).status,200);
    assert.equal(f.store.get<Contact>('contacts',f.contact.id)?.name,'Updated Person');
    assert.deepEqual(outreachContext(f.store,f.contact).evidence.map(e=>e.id),['ev']);
  }finally{f.close();}
});
test('outreach queue captures provider, rejects duplicates, persists reviewable drafts and edits',async()=>{
  const f=await fixture();try{
    const r=await f.request(`/contacts/${f.contact.id}/outreach`,{provider:'claude-code'});assert.equal(r.status,202);const task=await r.json() as Task;
    assert.equal((await f.request(`/contacts/${f.contact.id}/outreach`,{})).status,409);
    const events:string[]=[];await processOneTask(f.store,{...unused,generateOutreach:async(input:OutreachInput)=>{assert.equal(input.provider,'claude-code');assert.equal(input.context.signals[0].status,'unconfirmed');return output;}},event=>{events.push(event.kind);});
    const saved=f.store.get<Contact>('contacts',f.contact.id)!;assert.equal(saved.status,'new');assert.equal(saved.email,'');assert.equal(saved.outreachDrafts?.length,1);assert.equal(f.store.get<Task>('tasks',task.id)?.status,'done');assert.deepEqual(events,['outreach']);
    const draft=saved.outreachDrafts![0];const path=`/contacts/${saved.id}/outreach/${draft.id}`;
    assert.equal((await f.request(path,{subject:draft.subject,body:draft.body,reviewed:true},'PATCH')).status,200);
    assert.ok(f.store.get<Contact>('contacts',saved.id)?.outreachDrafts![0].reviewedAt);
    await f.request(`/contacts/${saved.id}`,{notes:'New context that changes the approach.'},'PATCH');
    assert.equal(f.store.get<Contact>('contacts',saved.id)?.outreachDrafts![0].stale,true);
    assert.equal((await f.request(path,{subject:draft.subject,body:draft.body,reviewed:true},'PATCH')).status,422);
    assert.equal((await f.request(path,{},'DELETE')).status,200);
  }finally{f.close();}
});
test('context changed during drafting or invalid evidence fails without saving, and retries keep provider',async()=>{
  const f=await fixture();try{
    const task=await f.request(`/contacts/${f.contact.id}/outreach`,{provider:'claude-code'}).then(r=>r.json()) as Task;
    await processOneTask(f.store,{...unused,generateOutreach:async()=>{f.store.save('contacts',{...f.contact,notes:'Changed during the model call'});return output;}});
    assert.match(f.store.get<Task>('tasks',task.id)!.error!,/context changed/);assert.equal(f.store.get<Contact>('contacts',f.contact.id)?.outreachDrafts,undefined);
    const retry=await f.request(`/tasks/${task.id}/retry`,{});assert.equal(retry.status,202);assert.equal(f.store.get<Task>('tasks',task.id)?.provider,'claude-code');
    await processOneTask(f.store,{...unused,generateOutreach:async()=>({...output,evidenceIds:['invented']})});
    assert.match(f.store.get<Task>('tasks',task.id)!.error!,/unknown evidence/);assert.equal(f.store.get<Contact>('contacts',f.contact.id)?.outreachDrafts,undefined);
  }finally{f.close();}
});
test('outreach caps count failed attempts and closed signals block drafting',async()=>{
  const f=await fixture();try{
    f.store.setMeta('settings',{...f.store.meta<Settings>('settings')!,dailyLimit:1});
    const task=await f.request(`/contacts/${f.contact.id}/outreach`,{}).then(r=>r.json()) as Task;
    await processOneTask(f.store,{...unused,generateOutreach:async()=>{throw new Error('Fixture provider unavailable');}});
    assert.equal(f.store.get<Task>('tasks',task.id)?.status,'failed');
    assert.equal((await f.request(`/tasks/${task.id}/retry`,{})).status,429);
    await f.request(`/contacts/${f.contact.id}`,{signals:[{...f.contact.signals![0],status:'closed'}]},'PATCH');
    assert.equal((await f.request(`/contacts/${f.contact.id}/outreach`,{})).status,422);
  }finally{f.close();}
});
test('portable contacts reject missing linked roles and preserve completed draft relationships',async()=>{
  const f=await fixture();try{
    const bundle=await f.request('/portability/export',undefined,'GET').then(r=>r.json());
    bundle.records.find((r:{id:string})=>r.id===f.contact.id).data.jobIds=['missing'];
    assert.equal((await f.request('/portability/preview',{bundle})).status,400);
  }finally{f.close();}
});

test('changing a source URL alone invalidates reviewed outreach',async()=>{
  const f=await fixture();try{
    await f.request(`/contacts/${f.contact.id}/outreach`,{});
    await processOneTask(f.store,{...unused,generateOutreach:async()=>output});
    const draft=f.store.get<Contact>('contacts',f.contact.id)!.outreachDrafts![0];
    await f.request(`/contacts/${f.contact.id}/outreach/${draft.id}`,{subject:draft.subject,body:draft.body,reviewed:true},'PATCH');
    await f.request(`/contacts/${f.contact.id}`,{signals:[{...f.contact.signals![0],url:'https://example.invalid/different-post'}]},'PATCH');
    assert.equal(f.store.get<Contact>('contacts',f.contact.id)!.outreachDrafts![0].stale,true);
  }finally{f.close();}
});
