import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { id, now, type Store, type Job } from './db.js';

export type MailKind = 'receipt'|'interview'|'assessment'|'rejection'|'offer'|'recommendation'|'other';
export interface InboxMessage {
  id:string; providerId:string; mailboxId:string; threadId:string; subject:string; sender:string;
  snippet:string; receivedAt:string; url:string; kind:MailKind; company:string; role:string;
  confidence:'high'|'medium'|'low'; reason:string; jobId:string|null; direction:'incoming'|'outgoing';
  reference?:string; location?:string;
}
export interface InboxCoverage { checkedAt:string; query:string; pages:number; messages:number; oldest:string|null; newest:string|null; complete:boolean; detail:string; nextPageToken?:string }
export interface InboxCandidate { id:string; company:string; role:string; eventKind:MailKind; lastSeen:string; messageIds:string[]; confidence:InboxMessage['confidence']; jobId:string|null; reason:string }
const normal=(s:string)=>s.toLowerCase().normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim();
const clean=(s:string)=>s.replace(/&amp;/g,'&').replace(/&#39;|&#x27;/g,"'").replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().replace(/[.,:;]+$/,'');
const digest=(s:string)=>createHash('sha256').update(s).digest('hex').slice(0,32);
const date=z.string().max(60).refine(v=>Number.isFinite(Date.parse(v)),'Invalid message date');
export const inboxInput=z.object({providerId:z.string().min(1).max(300),mailboxId:z.string().min(1).max(300),threadId:z.string().max(300),subject:z.string().max(2000),sender:z.string().max(1000),snippet:z.string().max(12000),receivedAt:date,url:z.string().url().max(3000).refine(s=>/^https:\/\//.test(s)),direction:z.enum(['incoming','outgoing']).default('incoming')});
export const coverageInput=z.object({checkedAt:date,query:z.string().max(5000),pages:z.number().int().min(0),messages:z.number().int().min(0),oldest:date.nullable(),newest:date.nullable(),complete:z.boolean(),detail:z.string().max(3000),nextPageToken:z.string().max(1000).optional()});

/** Conservative first-pass extraction. Every result retains the original observation. */
export function classifyMessage(input:z.infer<typeof inboxInput>):InboxMessage {
  const subject=clean(input.subject), body=clean(input.snippet), text=subject+' '+body;
  let kind:MailKind='other', company='', role='', reason='No unambiguous application event found in the available excerpt.';
  if(input.direction==='outgoing')reason='Sent correspondence retained as evidence; quoted employer text is not treated as a new employer decision.';
  else if(/(?:strong match for you|just went live|roles for your|new roles|job alert|worth a look|application experience|requests feedback|interview (?:tips|etiquette|formats)|how to do case)/i.test(text))kind='recommendation';
  else if(/(?:not (?:be )?(?:progressing|proceeding|selected)|will not be (?:moving|progressing)|decided not to|regret to inform|unfortunately.{0,100}(?:application|position|role|candidate|filled|move)|unsuccessful)/i.test(body))kind='rejection';
  else if(/(?:interview (?:introduction|request|invitation)|invited.{0,55}interview|get ready for your.{0,130}interview|invite you.{0,40}interview)/i.test(text))kind='interview';
  else if(/(?:online test invitation|invited.{0,65}assessment|complete.{0,35}assessment|assessment invitation|invited to take the next step)/i.test(text))kind='assessment';
  else if(/(?:pleased to offer you|offer of employment|your (?:employment|job) offer)/i.test(text))kind='offer';
  else if(/(?:thank(?:s| you) for (?:applying|your application|submitting your application)|application (?:has been |was )?(?:received|submitted|confirmation)|successfully submitted|received your application|we appreciate your interest.{0,80}applied|indeed application:|application acknowledgement|your application at )/i.test(text))kind='receipt';
  const patterns:[RegExp,'role-company'|'company-role'][]=[
    [/keen to interview for the (.+?) role at (.+?), and /i,'role-company'],
    [/get ready for your (.+?) interview at (.+)$/i,'role-company'],
    [/applying to the role of (.+?) (?:- \d+ )?at (.+?)(?:\. |$)/i,'role-company'],
    [/received your application for the (.+?) position.{0,80}/i,'role-company'],
    [/thank you for applying (?:for|to) (?:the )?(.+?) (?:role )?(?:here )?at (.+?)(?:[.!] |$)/i,'role-company'],
    [/your application: (.+?) - (.+?) - [A-Z]+\d+$/i,'company-role'],
    [/application received for (.+?), (London|Dublin|New York)$/i,'role-company'],
  ];
  // Explicit templates override only identities, never chronology or current hiring outcome.
  for(const [pattern,order] of patterns){const m=subject.match(pattern)||body.match(pattern);if(m&&m[1]&&m[2]){[company,role]=order==='company-role'?[clean(m[1]),clean(m[2])]:[clean(m[2]),clean(m[1])];break;}}
  const prep=subject.match(/^Get ready for your (.+?) interview at (.+)$/i);if(prep){role=clean(prep[1]);company=clean(prep[2]);}
  const intro=body.match(/keen to interview for the (.+?) role at (.+?), and /i);if(intro){role=clean(intro[1]);company=clean(intro[2]);}
  const thank=subject.match(/^(?:Thank you for applying (?:to|at)|Thanks for applying at) (.+?)(?:: (?:\d+ - )?(.+))?$/i);if(thank){company=clean(thank[1]);if(thank[2])role=clean(thank[2]);}
  const specific=body.match(/application for the role of (.+?) has been received/i);if(specific)role=clean(specific[1]);
  const position=body.match(/(?:applying to|interest in) (?:the )?(.+?) (?:career opportunity|position|role) (?:available )?(?:at|with) (.+?)(?:[.!]|$)/i);if(position){role=clean(position[1]);company=clean(position[2]);}
  const confirmation=subject.match(/^(.+?)\s*[|:]\s*Application Confirmation$/i);if(confirmation){company=clean(confirmation[1]);const r=body.match(/application for the (.+?) position/i);if(r)role=clean(r[1]);}
  const acturis=subject.match(/^(.+?) - Application received for (.+)$/i);if(acturis){company=clean(acturis[1]);role=clean(acturis[2]);}
  const submitted=subject.match(/^You have successfully submitted your (.+?) job application - (.+)$/i);if(submitted){company=clean(submitted[1]);role=clean(submitted[2]);}
  const indeed=subject.match(/^Indeed Application:\s*(.+)$/i);if(indeed){role=clean(indeed[1]);const marker=body.match(/You submitted an application for:\s*/i);if(marker&&role){const remainder=body.slice((marker.index||0)+marker[0].length).trim();const afterRole=remainder.toLowerCase().startsWith(role.toLowerCase())?remainder.slice(role.length).trim():remainder;const companyPart=afterRole.split(/\s+-\s+/)[0].trim();if(companyPart&&companyPart.length<160)company=clean(companyPart);}}
  const appAt=subject.match(/^Your application at\s+(.+)$/i);if(appAt){company=clean(appAt[1]);const roleLine=body.match(/application for (?:the )?(.+?) (?:position|role)(?:[.,!]| at | with )/i);role=roleLine?clean(roleLine[1]):'';}
  const ack=subject.match(/^Application Acknowledgement with\s+(.+)$/i);if(ack){company=clean(ack[1]);const roleLine=body.match(/application for the (.+?) position/i);if(roleLine)role=clean(roleLine[1]);}
  const thanksFrom=subject.match(/^Thank you from\s+(.+)$/i);if(thanksFrom)company=clean(thanksFrom[1]);
  const rezoomo=body.match(/New message - (.+?) (?:January|February|March|April|May|June|July|August|September|October|November|December) \d+, \d{4} You have a new message sent by .+? from (.+?) in your Rezoomo account/i);if(rezoomo){role=clean(rezoomo[1]);company=clean(rezoomo[2]);}
  const advancy=body.match(/interest in the (.+?) at (.+?)\. I would like to inform you/i);if(advancy){role=clean(advancy[1]);company=clean(advancy[2]);}
  const spoon=subject.match(/ & (.+?)[—–-]Application received/i);if(spoon){company=clean(spoon[1]);const r=body.match(/apply for the (.+?) job at /i);if(r)role=clean(r[1]);}
  const atRole=body.match(/for (.+?) at (.+?)\. Your profile looks/i);if(atRole){role=clean(atRole[1]);company=clean(atRole[2]);}
  const exl=body.match(/applying for the (.+?) role at (.+?)\./i);if(exl){role=clean(exl[1]);company=clean(exl[2]);}
  // The generic pattern with only a position has no second capture; leave unknown identity for review.
  company=company.replace(/[!]+$/,'').trim();
  role=role.replace(/^applying for\s+/i,'').trim();
  const invalidCompany=company.length>120||/^(the|us|this time|our company|London|Dublin|South Dublin|Dundrum|New York)$/i.test(company)||/\b(?:submitted|follow|get job updates|more jobs|thank you|we appreciate|unfortunately|your application|hi |dear )/i.test(company);
  const invalidRole=role.length>180||/^(?:a (?:role|position)|work with us|one of our\b|study\b)/i.test(role)||/\b(?:hi |dear |thank you|your application|we appreciate|we have received|unfortunately|will not be progressing)/i.test(role)||normal(role)===normal(company);
  if(invalidCompany)company='';
  if(invalidRole)role='';
  // Aggregator receipts often run employer, location and recommended vacancies
  // together in a truncated excerpt. Retain the observation for manual review.
  const ambiguousAggregator=Boolean(indeed);
  if(/^(re|fw|fwd):/i.test(subject)&&!intro&&!prep){kind='other';reason='Reply requires full conversation review; quoted history is not a new event.';}
  const confidence=input.direction==='incoming'&&company&&role&&!ambiguousAggregator&&!['other','recommendation'].includes(kind)?'high':(company||role)&&kind!=='other'?'medium':'low';
  if(confidence==='high')reason='Explicit event and role identity found in this excerpt. This is a historical observation, not confirmation of today’s status.';
  else if(kind!=='other')reason=kind==='recommendation'?'Recommendation or general advice; does not prove an application.':'Possible application event; company or exact role needs more evidence.';
  return {...input,id:'mail_'+digest(input.mailboxId+'\0'+input.providerId),subject,snippet:body,kind,company,role,confidence,reason,jobId:null};
}

export function inboxCandidates(messages:InboxMessage[]):InboxCandidate[] {
  const groups=new Map<string,InboxMessage[]>();
  for(const message of messages){
    const key=message.confidence==='high'?normal(message.mailboxId)+'\0'+normal(message.company)+'\0'+normal(message.role)+'\0'+normal(message.reference||'')+'\0'+normal(message.location||''):message.id;
    const linkedKey=key+'\0'+(message.jobId||'unlinked');
    const group=groups.get(linkedKey)||[];group.push(message);groups.set(linkedKey,group);
  }
  return [...groups.entries()].map(([key,group])=>{group.sort((a,b)=>Date.parse(b.receivedAt)-Date.parse(a.receivedAt));const latest=group[0];return {id:'candidate_'+digest(key),company:latest.company,role:latest.role,eventKind:latest.kind,lastSeen:latest.receivedAt,messageIds:group.map(m=>m.id),confidence:latest.confidence,jobId:group.find(m=>m.jobId)?.jobId||null,reason:latest.reason};}).sort((a,b)=>Date.parse(b.lastSeen)-Date.parse(a.lastSeen));
}
export function ingestInbox(store:Store,input:{messages:unknown[];coverage:unknown}) {
  const parsed=z.array(inboxInput).max(5000).parse(input.messages),coverage=coverageInput.parse(input.coverage);
  let imported=0;
  store.transaction(()=>{for(const value of parsed){const item=classifyMessage(value);const old=store.get<InboxMessage>('inbox_messages',item.id);if(old)continue;store.save('inbox_messages',item);imported++;}store.setMeta('inboxCoverage',{...coverage,messages:store.all('inbox_messages').length});});
  return {imported,total:store.all('inbox_messages').length};
}
export function recoverInbox(store:Store,candidateIds:string[]) {
  const selected=new Set(candidateIds),messages=store.all<InboxMessage>('inbox_messages');
  const candidates=inboxCandidates(messages).filter(c=>selected.has(c.id));
  let created=0,linked=0,skipped=0;
  store.transaction(()=>{for(const candidate of candidates){
    if(candidate.jobId||candidate.confidence!=='high'||['recommendation','other'].includes(candidate.eventKind)){skipped++;continue;}
    const matches=store.all<Job>('jobs').filter(j=>normal(j.company)===normal(candidate.company)&&normal(j.title)===normal(candidate.role));
    if(matches.length>1){skipped++;continue;}
    const group=messages.filter(m=>candidate.messageIds.includes(m.id));
    // Repeated receipts months apart can be separate cycles/locations; do not silently merge them.
    const receipts=group.filter(m=>m.kind==='receipt').sort((a,b)=>Date.parse(a.receivedAt)-Date.parse(b.receivedAt));
    if(receipts.length>1&&Date.parse(receipts.at(-1)!.receivedAt)-Date.parse(receipts[0].receivedAt)>7*86400000){skipped++;continue;}
    let job=matches[0];
    if(!job){const status:Job['status']=candidate.eventKind==='rejection'?'rejected':candidate.eventKind==='offer'?'offer':['interview','assessment'].includes(candidate.eventKind)?'interviewing':'applied';
      job={id:id(),company:candidate.company,title:candidate.role,location:'',source:'Gmail recovery',url:'',status,deadline:null,description:'',notes:`Latest observed email event: ${candidate.eventKind}, ${candidate.lastSeen.slice(0,10)}. Historical recovery from a search snapshot; check subsequent correspondence before relying on this as a current status.`,fit:null,fitReason:'Not assessed',createdAt:now(),updatedAt:now(),needsReview:true};store.save('jobs',job);created++;
    }else linked++;
    for(const message of group)store.save('inbox_messages',{...message,jobId:job.id});
  }if(created||linked)store.activity(`Recovered ${created} applications and linked evidence to ${linked} existing applications.`);});
  return {created,linked,skipped};
}
const linkInput=z.object({messageIds:z.array(z.string().min(1).max(100)).min(1).max(500),jobId:z.string().min(1).max(100).optional(),company:z.string().trim().min(1).max(160).optional(),title:z.string().trim().min(1).max(200).optional()}).refine(value=>value.jobId?!value.company&&!value.title:Boolean(value.company&&value.title),'Choose an existing application or supply both company and role.');
export function linkInbox(store:Store,value:unknown) {
  const input=linkInput.parse(value);
  const messages=[...new Set(input.messageIds)].map(messageId=>store.get<InboxMessage>('inbox_messages',messageId));
  if(messages.some(message=>!message))throw Object.assign(new Error('Some source messages no longer exist. Refresh the evidence and try again.'),{status:404});
  const existing=input.jobId?store.get<Job>('jobs',input.jobId):undefined;
  if(input.jobId&&!existing)throw Object.assign(new Error('That application no longer exists.'),{status:404});
  if(messages.some(message=>message!.jobId&&message!.jobId!==existing?.id))throw Object.assign(new Error('Some evidence is already linked to another application. Its existing link has been preserved.'),{status:409});
  const job:Job=existing||{id:id(),company:input.company!,title:input.title!,location:'',source:'Inbox review',url:'',status:'unknown',deadline:null,description:'',notes:'Identity supplied during inbox review. Historical correspondence is attached; application status has not been confirmed.',fit:null,fitReason:'Not assessed',createdAt:now(),updatedAt:now(),needsReview:true};
  store.transaction(()=>{
    if(!existing)store.save('jobs',job);
    for(const message of messages)store.save('inbox_messages',{...message!,jobId:job.id});
    store.activity(`Linked ${messages.length} source messages to an application after identity review.`);
  });
  return {jobId:job.id,created:!existing,linked:messages.length};
}
export function createInboxRouter(store:Store){
  const router=Router();
  router.get('/',(_req,res)=>{const messages=store.all<InboxMessage>('inbox_messages');res.json({messages,candidates:inboxCandidates(messages),coverage:store.meta('inboxCoverage')||null});});
  router.post('/import',(req,res)=>{const input=z.object({messages:z.array(z.unknown()).max(5000),coverage:z.unknown()}).parse(req.body);res.json(ingestInbox(store,input));});
  router.post('/recover',(req,res)=>{const input=z.object({candidateIds:z.array(z.string().max(100)).min(1).max(500)}).parse(req.body);res.json(recoverInbox(store,input.candidateIds));});
  router.post('/link',(req,res)=>{try{res.json(linkInbox(store,req.body));}catch(error){const status=(error as {status?:number}).status;if(status){res.status(status).json({error:(error as Error).message});return;}throw error;}});
  return router;
}
