import { Router } from 'express';
import { z } from 'zod';
import { id, now, type Store, type Job, type Task } from './db.js';
import { suggestedTrack } from '../src/jobTracks.js';

export const scoutingPreferences=z.object({roles:z.array(z.string().trim().min(1).max(200)).max(20),locations:z.array(z.string().trim().min(1).max(100)).max(20),notes:z.string().max(5000)}).strict();
const https=z.string().url().max(2000).refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;});
const deadline=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const parsed=new Date(value+'T12:00:00Z');return Number.isFinite(parsed.valueOf())&&parsed.toISOString().slice(0,10)===value;}).nullable().optional();
const role=z.object({deadline,company:z.string().trim().min(1).max(200),title:z.string().trim().min(1).max(240),location:z.string().max(200),url:https,description:z.string().trim().min(80).max(45000),eligibility:z.enum(['eligible','uncertain','ineligible']),eligibilityNotes:z.string().min(1).max(3000),employmentType:z.enum(['full_time','part_time','contract','internship','unknown']).default('unknown')}).strict();
const batch=z.object({checkedAt:z.string().datetime(),queries:z.array(z.string().max(500)).min(1).max(20),roles:z.array(role).max(7)}).strict();
function canonical(value:string){try{const url=new URL(value);url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_|^(?:ref|source)$/i.test(key))url.searchParams.delete(key);return url.toString().replace(/\/$/,'');}catch{return '';}}
const normal=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function importScouting(store:Store,body:unknown,enqueue:(job:Job)=>Task|undefined){
  const input=batch.parse(body);
  if(Date.parse(input.checkedAt)>Date.now()+300000||Date.now()-Date.parse(input.checkedAt)>86400000)throw new Error('Scout results must have been checked within the last day.');
  const result={created:0,queued:0,skipped:0,held:0,jobIds:[] as string[],taskIds:[] as string[]};
  store.transaction(()=>{
    for(const candidate of input.roles){
      if(candidate.eligibility==='ineligible'||suggestedTrack(candidate.title)==='income'){result.skipped++;continue;}
      const url=canonical(candidate.url);
      const duplicate=store.all<Job>('jobs').some(job=>job.url&&canonical(job.url)===url||normal(job.company)===normal(candidate.company)&&normal(job.title)===normal(candidate.title)&&normal(job.location)===normal(candidate.location));
      if(duplicate){result.skipped++;continue;}
      const job:Job={id:id(),company:candidate.company,title:candidate.title,location:candidate.location,url,description:candidate.description,source:'Scheduled career scout',track:'career',employmentType:candidate.employmentType,status:'saved',deadline:candidate.deadline??null,notes:`Posting checked: ${input.checkedAt}. Eligibility: ${candidate.eligibility}. ${candidate.eligibilityNotes}`,needsReview:true,fit:null,fitReason:'Not assessed',createdAt:now(),updatedAt:now()};
      store.save('jobs',job);result.created++;result.jobIds.push(job.id);
      const task=candidate.eligibility==='eligible'?enqueue(job):undefined;
      if(task){result.queued++;result.taskIds.push(task.id);store.save('jobs',{...job,status:'preparing'});}else result.held++;
    }
    store.setMeta('scoutStatus',{lastRunAt:input.checkedAt,queries:input.queries,...result});
    store.activity(`Career scout: ${result.created} new roles, ${result.queued} application packs queued, ${result.held} held, ${result.skipped} duplicates or excluded roles.`);
  });
  return result;
}
export function createScoutingRouter(store:Store,enqueue:(job:Job)=>Task|undefined){
  const router=Router();
  router.get('/',(_req,res)=>res.json({preferences:store.meta('scoutingPreferences')||null,schedule:store.meta('scoutingSchedule')||null,lastRun:store.meta('scoutStatus')||null}));
  router.put('/preferences',(req,res)=>{const input=scoutingPreferences.parse(req.body);store.setMeta('scoutingPreferences',input);res.json(input);});
  router.put('/schedule',(req,res)=>{const input=z.object({enabled:z.boolean(),times:z.array(z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)).max(3),timeZone:z.literal('Europe/Dublin'),automationId:z.string().max(200)}).parse(req.body);store.setMeta('scoutingSchedule',input);res.json(input);});
  router.post('/import',(req,res)=>res.json(importScouting(store,req.body,enqueue)));
  return router;
}
