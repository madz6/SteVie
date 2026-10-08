import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMessage, inboxCandidates, ingestInbox, recoverInbox, linkInbox, type InboxMessage } from '../server/inbox.js';
import { createStore, type Job } from '../server/db.js';

const mail=(id:string,subject:string,snippet:string,receivedAt='2026-10-01T12:00:00Z')=>({providerId:id,mailboxId:'fixture',threadId:'same-thread',subject,snippet,sender:'Example Recruiter <careers@example.com>',receivedAt,url:'https://mail.google.com/mail/u/0/#all/'+id,direction:'incoming' as const});
const coverage={checkedAt:'2026-10-06T12:00:00Z',query:'fixture',pages:1,messages:0,oldest:null,newest:null,complete:false,detail:'Partial fixture'};
test('one email conversation may contain two roles; recommendations never prove an application',()=>{
  const a=classifyMessage(mail('a','Get ready for your Analyst interview at Example Co','Get ready for your interview'));
  const b=classifyMessage(mail('b','Get ready for your Engineer interview at Example Co','Get ready for your interview'));
  assert.equal(a.company,'Example Co');assert.equal(a.role,'Analyst');assert.equal(a.confidence,'high');assert.equal(inboxCandidates([a,b]).length,2);
  assert.equal(classifyMessage(mail('c','Analyst @ Example Co just went live and it is a strong match for you','New role')).kind,'recommendation');
});
test('body rejection outranks receipt subject, and outbound quoted text cannot create an employer event',()=>{
  const value=mail('a','Thank you for applying to Example Co','Thank you for expressing interest in the Analyst career opportunity available with Example Co. After careful review we regret to inform you that we have chosen another applicant.');
  assert.equal(classifyMessage(value).kind,'rejection');
  assert.equal(classifyMessage({...value,direction:'outgoing'}).kind,'other');
});
test('Indeed and acknowledgement receipts retain roles where the mailbox supplies them',()=>{
  const indeed=classifyMessage(mail('indeed','Indeed Application: Summer Sales Advisor','You submitted an application for: Summer Sales Advisor Uniformity - Three Rock Road, Sandyford, Dublin Submitted'));
  assert.equal(indeed.kind,'receipt');assert.equal(indeed.role,'Summer Sales Advisor');assert.equal(indeed.company,'Uniformity');
  assert.equal(indeed.confidence,'medium');
  const ack=classifyMessage(mail('ack','Application Acknowledgement with Central Bank of Ireland','Thank you for your application for the Graduate Programme 2027 position.'));
  assert.equal(ack.kind,'receipt');assert.equal(ack.company,'Central Bank of Ireland');assert.equal(ack.role,'Graduate Programme 2027');
});

test('greetings, generic roles and aggregator recommendations are never confident application identities',()=>{
  const examples=[
    mail('generic','Your application at Example Co','Thank you for applying for a role with us. We will review your application.'),
    mail('bridge','Thank you for applying to Example Co!','Hi Alex, Thanks for applying for a role with us. Your experience at Example Firm was noted.'),
    mail('snippet','Indeed Application: Receptionist','You submitted an application for: Receptionist Dublin Submitted Follow Get job updates from Other Firm'),
    mail('generic-role','Thank you for applying to Example Co','Thank you for applying for a position at Example Co.'),
  ];
  for(const example of examples)assert.notEqual(classifyMessage(example).confidence,'high',example.providerId);
});
test('mail import/recovery is repeatable and never changes an archived application',()=>{
  const store=createStore(':memory:',false);
  const message=mail('a','Get ready for your Analyst interview at Example Co','Interview request');
  assert.equal(ingestInbox(store,{messages:[message],coverage}).imported,1);
  assert.equal(ingestInbox(store,{messages:[message],coverage}).imported,0);
  const candidates=inboxCandidates(store.all('inbox_messages'));
  assert.equal(recoverInbox(store,candidates.map(c=>c.id)).created,1);
  assert.equal(recoverInbox(store,candidates.map(c=>c.id)).created,0);
  const job=store.all<Job>('jobs')[0];store.save('jobs',{...job,status:'archived'});
  ingestInbox(store,{messages:[mail('b',message.subject,message.snippet)],coverage});
  recoverInbox(store,inboxCandidates(store.all('inbox_messages')).map(c=>c.id));
  assert.equal(store.get<Job>('jobs',job.id)?.status,'archived');store.close();
});
test('repeated receipts far apart are held for identity review instead of silently combining cycles',()=>{
  const store=createStore(':memory:',false);
  ingestInbox(store,{messages:[mail('a','Acturis - Application received for Graduate Analyst, London','Your application was received','2026-06-01T12:00:00Z'),mail('b','Acturis - Application received for Graduate Analyst, London','Your application was received','2026-10-01T12:00:00Z')],coverage});
  const result=recoverInbox(store,inboxCandidates(store.all('inbox_messages')).map(c=>c.id));
  assert.equal(result.created,0);assert.equal(result.skipped,1);store.close();
});

test('reviewed recommendation identity creates an unknown record and preserves source observations',()=>{
  const store=createStore(':memory:',false);
  try{
    ingestInbox(store,{messages:[mail('recommendation','A strong match for you','New roles worth a look')],coverage});
    const message=store.all<InboxMessage>('inbox_messages')[0];
    const result=linkInbox(store,{messageIds:[message.id],company:'Example Co',title:'Analyst'});
    assert.equal(store.get<Job>('jobs',result.jobId)?.status,'unknown');
    assert.deepEqual(store.get<InboxMessage>('inbox_messages',message.id),{...message,jobId:result.jobId});
    store.save('jobs',{...store.get<Job>('jobs',result.jobId)!,status:'archived'});
    assert.equal(linkInbox(store,{messageIds:[message.id],jobId:result.jobId}).created,false);
    assert.equal(store.get<Job>('jobs',result.jobId)?.status,'archived');
  }finally{store.close();}
});
test('manual evidence links reject missing sources and reassignment without partial changes',()=>{
  const store=createStore(':memory:',false);
  try{
    ingestInbox(store,{messages:[mail('a','Unknown role','A note'),mail('b','Unknown role','Another note')],coverage});
    const [a,b]=store.all<InboxMessage>('inbox_messages');
    assert.throws(()=>linkInbox(store,{messageIds:[a.id,'missing'],company:'Example',title:'Analyst'}));
    assert.equal(store.all('jobs').length,0);
    const first=linkInbox(store,{messageIds:[a.id],company:'Example',title:'Analyst'});
    assert.throws(()=>linkInbox(store,{messageIds:[a.id,b.id],company:'Different',title:'Engineer'}));
    assert.equal(store.all('jobs').length,1);
    assert.equal(store.get<InboxMessage>('inbox_messages',b.id)?.jobId,null);
    assert.throws(()=>linkInbox(store,{messageIds:[b.id],jobId:first.jobId,company:'Ambiguous',title:'Mode'}));
  }finally{store.close();}
});
test('grouping separates linked evidence from matching but unreviewed messages',()=>{
  const a=classifyMessage(mail('a','Get ready for your Analyst interview at Example Co','Interview invitation'));
  const b=classifyMessage(mail('b',a.subject,a.snippet));
  const candidates=inboxCandidates([{...a,jobId:'reviewed-job'},b]);
  assert.equal(candidates.length,2);
  assert.equal(candidates.find(candidate=>!candidate.jobId)?.messageIds[0],b.id);
});
