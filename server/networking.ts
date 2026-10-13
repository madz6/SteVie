import {createHash} from 'node:crypto';
import {z} from 'zod';
import {type Store,type Contact,type Job,type Evidence,type Profile} from './db.js';

const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.valueOf())&&d.toISOString().slice(0,10)===value;},'Use a valid date.');
const url=z.string().trim().max(2000).refine(value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}},'Use a full public source URL.');
export const signalSchema=z.object({id:z.string().min(1).max(300),url,observedOn:date,summary:z.string().trim().min(20).max(4000),status:z.enum(['unconfirmed','confirmed','closed'])}).strict();
export const networkingFields={jobIds:z.array(z.string().min(1).max(300)).max(30).refine(ids=>new Set(ids).size===ids.length).optional(),signals:z.array(signalSchema).max(20).refine(signals=>new Set(signals.map(s=>s.id)).size===signals.length).optional()};
export const outreachOutput=z.object({subject:z.string().trim().min(1).max(200),body:z.string().trim().min(40).max(4000),flags:z.array(z.string().max(1000)).max(20),evidenceIds:z.array(z.string().min(1).max(300)).min(1).max(30)}).strict();
export const outreachDraftSchema=outreachOutput.extend({id:z.string().min(1).max(300),provider:z.enum(['codex','claude-code','openai','anthropic']),createdAt:z.iso.datetime(),editedAt:z.iso.datetime().optional(),reviewedAt:z.iso.datetime().optional(),stale:z.boolean().optional()}).strict();

// Only context relevant to the approach is shared. Email addresses and private
// source URLs are retained for review locally, not needed in the drafting input.
export function outreachContext(store:Store,contact:Contact){
  const signals=(contact.signals||[]).filter(s=>s.status!=='closed').map(({observedOn,summary,status})=>({observedOn,summary,status}));
  const jobs=(contact.jobIds||[]).map(id=>store.get<Job>('jobs',id)).filter((j):j is Job=>!!j).map(({company,title,description,status})=>({company,title,description:description.slice(0,9000),status}));
  const evidence=store.all<Evidence>('evidence').filter(e=>e.status!=='unresolved'&&!/contact|personal/i.test(e.category)).map(({id,text,category,status})=>({id,text,category,status}));
  return {contact:{name:contact.name,company:contact.company,role:contact.role,notes:contact.notes},signals,jobs,evidence,profile:store.meta<Profile>('profile')};
}
export type OutreachInput={provider:string;context:ReturnType<typeof outreachContext>};
export function contextFingerprint(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}

export function outreachFingerprint(store:Store,contact:Contact){return contextFingerprint({context:outreachContext(store,contact),signals:contact.signals,jobIds:contact.jobIds});}
