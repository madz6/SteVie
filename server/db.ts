import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { importInitialData } from './import.js';
import type { InboxMessage } from './inbox.js';

export type JobStatus = 'saved'|'preparing'|'ready'|'applied'|'interviewing'|'offer'|'rejected'|'archived'|'unknown';
export interface Job { track?:'career'|'income'|'unclassified'; employmentType?:'full_time'|'part_time'|'contract'|'internship'|'unknown'; id:string; company:string; title:string; location:string; source:string; url:string; status:JobStatus; deadline:string|null; description:string; notes:string; fit:number|null; fitReason:string; createdAt:string; updatedAt:string; needsReview:boolean }
export interface Task { id:string; kind:'application'|'practice'|'scout'; jobId:string|null; status:'queued'|'running'|'done'|'failed'; error:string|null; createdAt:string; finishedAt:string|null; provider?:string; practiceId?:string; attempts?:number }
export interface Document { reviewChecks?:{flag:string;note:string;reviewedAt:string}[]; id:string; jobId:string; kind:'cv'|'letter'|'answers'|'brief'; title:string; content:string; status:'draft'|'needs_review'|'approved'; createdAt:string; provider:string; flags:string[]; evidenceIds?:string[]; generationFlags?:string[]; sourceSnapshots?:{id:string;title:string;source:string;url:string;updatedAt:string;excerpt:string}[] }
export interface Practice { id:string; jobId:string|null; kind:string; title:string; prompt:string; answer:string; draftAnswer?:string; feedback:string|null; score:number|null; status:string; createdAt:string; knowledgeId?:string|null; stage?:'clarify'|'structure'|'calculate'|'recommend'; stageAnswers?:Record<string,string>; timer?:{mode:'untimed'|'timed';elapsedSeconds:number}; sourceSnapshot?:{id:string;title:string;source:string;url:string;updatedAt:string;content:string} }
export interface Contact { id:string; name:string; company:string; role:string; email:string; profileUrl:string; notes:string; followUp:string|null; status:string }
export interface Learning { id:string; title:string; skill:string; status:'planned'|'active'|'done'; nextAction:string; createdAt:string }
export interface Evidence { id:string; category:string; text:string; source:string; status:'verified'|'user_stated'|'unresolved' }
export interface Activity { id:string; text:string; createdAt:string }
export interface KnowledgeItem { id:string; title:string; kind:'document'|'url'|'chat'|'github'|'case'; url:string; content:string; source:string; tags:string[]; status:'unreviewed'|'reviewed'|'archived'; createdAt:string; updatedAt:string }
export interface ScoutTarget { id:string; kind:'roles'|'people'; source:'linkedin'|'jumpstart'|'trackr'|'web'; query:string; notes:string; status:'planned'|'reviewing'|'done'|'paused'; createdAt:string; updatedAt:string }
export interface Settings { provider:string; jumpstartUrl:string; trackrUrl:string; linkedinUrl:string; dailyLimit:number }
export interface Profile { name:string; headline:string; location:string }
export interface Integration { id:string; name:string; status:'connected'|'available'|'setup_required'|'unavailable'; detail:string }
type Entity = Job|Task|Document|Practice|Contact|Learning|Evidence|Activity|KnowledgeItem|ScoutTarget|InboxMessage;
export type EntityType = 'jobs'|'tasks'|'documents'|'practice'|'contacts'|'learning'|'evidence'|'activity'|'knowledge'|'scouts'|'inbox_messages';
export const now = () => new Date().toISOString();
export const id = () => randomUUID();

export class Store {
  readonly database: DatabaseSync;
  constructor(path:string, seed=true, privateSeedPath?:string|null) {
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive:true });
    this.database = new DatabaseSync(path);
    this.database.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, type TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)));
      CREATE INDEX IF NOT EXISTS records_type ON records(type);
      CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS unique_job_url ON records(json_extract(data,'$.url')) WHERE type='jobs' AND json_extract(data,'$.url')<>'';
      CREATE UNIQUE INDEX IF NOT EXISTS active_application ON records(json_extract(data,'$.jobId')) WHERE type='tasks' AND json_extract(data,'$.kind')='application' AND json_extract(data,'$.status') IN ('queued','running');
      CREATE UNIQUE INDEX IF NOT EXISTS active_practice ON records(json_extract(data,'$.practiceId')) WHERE type='tasks' AND json_extract(data,'$.kind')='practice' AND json_extract(data,'$.status') IN ('queued','running');`);
    if (!this.meta('initialized')) {
      this.transaction(() => {
        this.setMeta('profile', {name:'',headline:'',location:''});
        this.setMeta('settings', {provider:'codex',jumpstartUrl:'https://app.jumpstart-uk.com/candidate/profile',trackrUrl:'',linkedinUrl:'https://www.linkedin.com',dailyLimit:20});
        if (seed) importInitialData(this,privateSeedPath);
        this.setMeta('initialized', true);
      });
    }
    const settings=this.meta<Partial<Settings>>('settings');
    if(settings)this.setMeta('settings',{provider:'codex',jumpstartUrl:'',trackrUrl:'',linkedinUrl:'https://www.linkedin.com',dailyLimit:20,...settings});
  }
  all<T extends Entity>(type:EntityType):T[] {
    return this.database.prepare('SELECT data FROM records WHERE type=? ORDER BY rowid DESC').all(type).map(row=>JSON.parse(row.data as string));
  }
  get<T extends Entity>(type:EntityType, recordId:string):T|undefined {
    const row=this.database.prepare('SELECT data FROM records WHERE id=? AND type=?').get(recordId,type);
    return row ? JSON.parse(row.data as string) : undefined;
  }
  save<T extends Entity>(type:EntityType, entity:T):T {
    this.database.prepare('INSERT INTO records(id,type,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE records.type=excluded.type').run(entity.id,type,JSON.stringify(entity));
    return entity;
  }
  meta<T=unknown>(key:string):T|undefined {
    const row=this.database.prepare('SELECT value FROM metadata WHERE key=?').get(key);
    return row ? JSON.parse(row.value as string) : undefined;
  }
  setMeta(key:string,value:unknown):void { this.database.prepare('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value)); }
  activity(text:string):void { this.save('activity',{id:id(),text,createdAt:now()}); }
  transaction<T>(fn:()=>T):T { this.database.exec('BEGIN IMMEDIATE'); try {const result=fn(); this.database.exec('COMMIT');return result;} catch(error) {this.database.exec('ROLLBACK');throw error;} }
  claimTask():Task|undefined {
    return this.transaction(()=>{
      const task=this.all<Task>('tasks').reverse().find(item=>item.status==='queued');
      if (!task) return;
      return this.save('tasks',{...task,status:'running' as const,attempts:(task.attempts||0)+1,error:null});
    });
  }
  recoverTasks():void {
    this.transaction(()=>{
      for (const task of this.all<Task>('tasks').filter(t=>t.status==='running')) {
        // Generation has no external side effect. A single interrupted attempt can safely resume.
        const retry=(task.attempts||0)<2;
        this.save('tasks',{...task,status:retry?'queued':'failed',error:retry?null:'Interrupted twice. Review the connection and retry.',finishedAt:retry?null:now()});
        if (!retry && task.jobId) {const job=this.get<Job>('jobs',task.jobId);if(job)this.save('jobs',{...job,status:'saved',needsReview:true,updatedAt:now()});}
      }
    });
  }
  close():void { this.database.close(); }
}
let defaultStore:Store|undefined;
export const createStore = (path:string, seed=true, privateSeedPath?:string|null) => new Store(path,seed,privateSeedPath);
export const getStore = () => defaultStore ??= new Store(process.env.STEVIE_DB || resolve('data/stevie.db'));
