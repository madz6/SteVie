# SteVie implementation contract

User authorized rebuild 6 Oct 2026. Single-user private Job OS. Clean rebuild, no local LLMs. React/TypeScript/Vite UI, Express 5/Node 24 server, built-in node:sqlite with durable tasks, worker in server. SQLite file in data/ on persistent disk. Local loopback default; remote deployments require login secret. One origin serves UI and API. No fake connected states. No external submission or email sending in the implementation/test phase. Jumpstart inspection pending real URL/session; store source and link, mark readiness honestly.

## Ownership
- Root: package/tooling, server/index.ts integration, notifications/PWA, running and visual checks, docs.
- Backend agent: server/db.ts, server/api.ts, server/documents.ts, server/import.ts, tests/backend.test.ts. Export createApi() Express router and startWorker()/stopWorker(). No edits outside owned files unless agreed.
- Frontend agent: src/** and index.html. Fetch /api endpoints below. No mock fallback. Mobile and desktop real states.
- AI agent: server/ai.ts plus tests/ai.test.ts. Native Codex ChatGPT auth first; optional Claude Code; direct OpenAI/Anthropic API when env provided. No Ollama fallback. Export contracts below.

## API and shape
GET /api/bootstrap => {profile:{name,headline,location},jobs:Job[],tasks:Task[],documents:Document[],practice:Practice[],contacts:Contact[],learning:Learning[],evidence:Evidence[],activity:Activity[],settings:{provider:string,jumpstartUrl:string,dailyLimit:number},integrations:Integration[]}
Job {id,company,title,location,source,url,status,deadline:string|null,description,notes,fit:number|null,fitReason,createdAt,updatedAt,needsReview:boolean}
statuses: saved, preparing, ready, applied, interviewing, offer, rejected, archived, unknown
Task {id,kind:'application'|'practice'|'scout',jobId:string|null,status:'queued'|'running'|'done'|'failed',error:string|null,createdAt,finishedAt:string|null}
Document {id,jobId,kind:'cv'|'letter'|'answers'|'brief',title,content:string,status:'draft'|'needs_review'|'approved',createdAt,provider,flags:string[]}
Practice {id,jobId:string|null,kind,title,prompt,answer,feedback:string|null,score:number|null,status,createdAt}
Contact {id,name,company,role,email,profileUrl,notes,followUp:string|null,status}
Learning {id,title,skill,status:'planned'|'active'|'done',nextAction,createdAt}
Evidence {id,category,text,source,status:'verified'|'user_stated'|'unresolved'}
Activity {id,text,createdAt}
Integration {id,name,status:'connected'|'available'|'setup_required'|'unavailable',detail}
All fields strings unless otherwise specified. JSON booleans real booleans. Dates ISO; deadlines YYYY-MM-DD/null. IDs string UUID. No private raw docs sent by bootstrap.

POST /api/jobs body {company,title,location?,url?,source?,description?,deadline?,notes?} => Job, duplicate URL returns 409.
PATCH /api/jobs/:id body subset {status,description,notes,deadline,title,company,location,url} => Job
POST /api/jobs/:id/prepare body {provider?} => Task, worker creates cv+letter+answers+brief docs, status ready only if passes guards, otherwise needsReview.
POST /api/tasks/:id/retry => Task (failed only)
PATCH /api/documents/:id {content?,status?} => Document
GET /api/documents/:id/download?format=pdf|md => file
POST /api/practice {jobId?,kind} => Practice (initial prompt deterministic relevant exercise; kinds behavioural,case,numerical,product)
POST /api/practice/:id/answer {answer,provider?} => Task; kind practice jobId may be null, task must reference practice internally.
POST /api/contacts {name,company?,role?,email?,profileUrl?,notes?,followUp?} => Contact
PATCH /api/contacts/:id {notes?,followUp?,status?} => Contact
POST /api/learning {title,skill?,nextAction?} => Learning
PATCH /api/learning/:id {status?,nextAction?} => Learning
PATCH /api/settings {provider?,jumpstartUrl?,dailyLimit?} => settings
GET /api/integrations => Integration[]
POST /api/integrations/:id/test => Integration (real connection test)
GET /api/health => {ok:true}
GET /api/notifications/status => {supported:boolean,publicKey:string|null,subscriptions:number,configured:boolean,detail:string}
POST /api/notifications/subscribe {subscription:<browser PushSubscription JSON>} => {ok:true}
POST /api/notifications/test => {ok:true,sent:number}
Error {error:string}. No silent fake results. UI polls bootstrap while queued/running.

## AI module contract
export type ProviderId = 'codex'|'claude-code'|'openai'|'anthropic';
export async function providerStatuses(): Promise<Integration[]>;
export async function testProvider(id: string): Promise<Integration>;
export async function generateApplication(input:{job:Job,evidence:Evidence[],profile:{name:string,headline:string,location:string},context:string,provider:string}):Promise<{cv:string,letter:string,answers:string,brief:string,fit:number,fitReason:string,evidenceIds:string[],flags:string[]}>;
export async function coachPractice(input:{kind:string,prompt:string,answer:string,context:string,provider:string}):Promise<{feedback:string,score:number}>;
Types may be locally structural to avoid shared-file contention. Context includes curated canonical profile/voice, no raw journal. Enforce output JSON schema; native CLI invocation no shell interpolation and fixed read-only scope. Never log secrets. Credentials not copied. OpenAI official Codex exec supports native sign-in for trusted noninteractive tasks.

## Import and data truth
Import explicitly configured private seed records on initial DB creation only. Fresh public checkouts have empty profiles and records. Reconcile unknown statuses without calling historical opportunities live or confirmed. Imported rows require review and retain historical dates. Candidate-specific exclusions stay in ignored private configuration. Generate facts only from provided evidence; unsupported claims require review and source IDs. Scoring describes evidence alignment, never interview odds.

## Design
Calm functional workspace: warm off-white main background, charcoal sidebar, forest green action, restrained orange deadlines, no gradients/glass/purple. Strong typography and spacing, concise concrete copy. Main views Today, Applications, Practice, People, Learning, Profile, Connections. Today daily action queue with small context; role list table and detail pane; responsive mobile nav. Real interactive forms for add job, edit status, prepare pack, inspect/edit/export docs, practice answer/feedback, contacts, learning, connection test. Empty/failure/loading states visible. No decorative dead buttons. Lucide icons. Product copy plain and factual.
