import {networkingFields,outreachDraftSchema} from './networking.js';
import { scoutingPreferences } from './scouting.js';
import { createHash, randomBytes } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createStore, type Store } from './db.js';

const MAX_BYTES = 25 * 1024 * 1024;
const MAX_RECORDS = 25_000;
const PREVIEW_TTL = 10 * 60_000;
const text = z.string().max(200_000);
const identifier = z.string().min(1).max(300);
const timestamp = z.string().max(100).refine(value => Number.isFinite(Date.parse(value)), 'Invalid timestamp.');
const nullableText = text.nullable();
const nullableId = identifier.nullable();
const strings = z.array(text).max(500);
const providers = z.enum(['codex', 'claude-code', 'openai', 'anthropic']);
const secretKey = /^(?:password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|cookies?|sessions?|session[_-]?(?:id|token)|credentials?)$/i;
const unsafeKey = /^(?:__proto__|prototype|constructor)$/;
const stage = z.enum(['clarify','structure','calculate','recommend']);
const sourceFields = { id: identifier, title: text, source: text, url: text, updatedAt: timestamp };
const documentSource = z.object({ ...sourceFields, excerpt: text }).strict();
const practiceSource = z.object({ ...sourceFields, content: text, truncated: z.boolean().optional(), originalLength: z.number().int().nonnegative().optional() }).strict();

// Validate optional fields too: the UI consumes progress, snapshots and flags
// directly. Unknown fields must not bypass the supported archive schema.
const schemas: Record<string, z.ZodType> = {
  jobs: z.object({ mobileEase:z.enum(['phone','laptop','unknown']).optional(),mobileNote:z.string().max(500).optional(),track:z.enum(['career','income','unclassified']).optional(), employmentType:z.enum(['full_time','part_time','contract','internship','unknown']).optional(), id: identifier, company: text, title: text, location: text, source: text, url: text, status: z.enum(['saved','preparing','ready','applied','interviewing','offer','rejected','archived','unknown']), deadline: nullableText, description: text, notes: text, fit: z.number().finite().nullable(), fitReason: text, createdAt: timestamp, updatedAt: timestamp, needsReview: z.boolean() }).strict(),
  tasks: z.object({ id: identifier, contactId:identifier.optional(), kind: z.enum(['application','practice','scout','outreach']), jobId: nullableId, status: z.enum(['queued','running','done','failed']), error: nullableText, createdAt: timestamp, finishedAt: timestamp.nullable(), provider: providers.optional(), reviewProvider:providers.optional(), practiceId: identifier.optional(), attempts: z.number().int().min(0).optional(), restoredStatus: z.enum(['queued','running']).optional() }).strict(),
  documents: z.object({ reviewChecks:z.array(z.object({flag:text,note:text,reviewedAt:timestamp}).strict()).max(100).optional(), id: identifier, jobId: identifier, kind: z.enum(['cv','letter','answers','brief']), title: text, content: text, status: z.enum(['draft','needs_review','approved']), createdAt: timestamp, provider: text, flags: strings, evidenceIds: z.array(identifier).max(500).optional(), generationFlags: strings.optional(), sourceSnapshots: z.array(documentSource).max(500).optional() }).strict(),
  practice: z.object({ reviewProviders:z.array(providers).min(1).max(2).optional(), id: identifier, jobId: nullableId, kind: text, title: text, prompt: text, answer: text, feedback: nullableText, score: z.number().finite().nullable(), status: text, createdAt: timestamp, knowledgeId: nullableId.optional(), draftAnswer: z.string().max(16000).optional(), stage: stage.optional(), stageAnswers: z.partialRecord(stage, text).optional(), timer: z.object({ mode: z.enum(['untimed','timed']), elapsedSeconds: z.number().int().min(0).max(604800) }).strict().optional(), sourceSnapshot: practiceSource.optional(), sourceLabel: text.optional(), synthetic: z.boolean().optional() }).strict(),
  contacts: z.object({ ...networkingFields,outreachDrafts:z.array(outreachDraftSchema).max(20).optional(), id: identifier, name: text, company: text, role: text, email: text, profileUrl: text, notes: text, followUp: nullableText, status: text }).strict(),
  learning: z.object({ id: identifier, title: text, skill: text, status: z.enum(['planned','active','done']), nextAction: text, createdAt: timestamp }).strict(),
  evidence: z.object({ id: identifier, category: text, text, source: text, status: z.enum(['verified','user_stated','unresolved']) }).strict(),
  activity: z.object({ id: identifier, text, createdAt: timestamp }).strict(),
  knowledge: z.object({ id: identifier, title: text, kind: z.enum(['document','url','chat','github','case']), url: text, content: text, source: text, tags: strings, status: z.enum(['unreviewed','reviewed','archived']), createdAt: timestamp, updatedAt: timestamp }).strict(),
  scouts: z.object({ id: identifier, kind: z.enum(['roles','people']), source: z.enum(['linkedin','linkedin_posts','jumpstart','trackr','web']), query: text, notes: text, status: z.enum(['planned','reviewing','done','paused']), createdAt: timestamp, updatedAt: timestamp }).strict(),
  inbox_messages: z.object({ id: identifier, providerId: identifier, mailboxId: identifier, threadId: text, subject: text, sender: text, snippet: text, receivedAt: timestamp, url: text, kind: z.enum(['receipt','interview','assessment','rejection','offer','recommendation','other']), company: text, role: text, confidence: z.enum(['high','medium','low']), reason: text, jobId: nullableId, direction: z.enum(['incoming','outgoing']), reference: text.optional(), location: text.optional() }).strict(),
  inbox_events: z.object({ id: identifier, messageId: identifier, jobId: nullableId }).strict(),
};
const profileSchema = z.object({ name: text, headline: text, location: text }).strict();
const settingsSchema = z.object({ provider: providers, jumpstartUrl: text, trackrUrl: text, linkedinUrl: text, dailyLimit: z.number().int().min(1).max(100) }).strict();
const coverageSchema = z.object({ checkedAt: timestamp, query: text, pages: z.number().int().min(0), messages: z.number().int().min(0), oldest: nullableText, newest: nullableText, complete: z.boolean(), detail: text }).strict();
const metadataSchema = z.object({ scoutingPreferences:scoutingPreferences.optional(), profile: profileSchema.optional(), settings: settingsSchema.optional(), inboxCoverage: coverageSchema.optional() }).strict();
const bundleSchema = z.object({
  format: z.literal('stevie-workspace'), version: z.literal(1), exportedAt: timestamp,
  records: z.array(z.object({ id: identifier, type: z.string().refine(value => Object.hasOwn(schemas, value), 'Unsupported record type.'), data: z.record(z.string(), z.unknown()) }).strict()).max(MAX_RECORDS),
  metadata: metadataSchema,
}).strict();
type RecordItem = { id: string; type: string; data: Record<string, unknown> };
type Metadata = z.infer<typeof metadataSchema>;
type Bundle = { format: 'stevie-workspace'; version: 1; exportedAt: string; records: RecordItem[]; metadata: Metadata };
type Summary = { create: number; skip: number; conflict: number };
type Plan = { summary: Summary; conflicts: string[]; warnings: string[]; records: RecordItem[]; metadata: Record<string, unknown>; fingerprint: string; expires: number };
class ImportError extends Error { constructor(public status: number, message: string) { super(message); } }

function stable(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ':' + stable(item)).join(',') + '}';
  return JSON.stringify(value) ?? 'null';
}
function checkJson(value: unknown, depth = 0): void {
  if (depth > 20) throw new ImportError(400, 'The archive contains excessively nested data.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (typeof value === 'string' && value.length <= 200_000) return;
  if (Array.isArray(value) && value.length <= MAX_RECORDS) { for (const item of value) checkJson(item, depth + 1); return; }
  if (typeof value === 'object' && value && Object.keys(value).length <= 200) {
    for (const [key, item] of Object.entries(value)) {
      if (key.length > 200 || unsafeKey.test(key) || secretKey.test(key)) throw new ImportError(400, 'The archive contains an unsupported or credential-related field.');
      checkJson(item, depth + 1);
    }
    return;
  }
  throw new ImportError(400, 'The archive contains invalid or oversized JSON values.');
}
function metadata(store: Store): Metadata {
  const pick = (key: string, fields: string[]) => {
    const source = store.meta<Record<string, unknown>>(key);
    return source ? Object.fromEntries(fields.filter(field => source[field] !== undefined).map(field => [field, source[field]])) : undefined;
  };
  return metadataSchema.parse({
    profile: pick('profile', ['name','headline','location']),
    settings: pick('settings', ['provider','jumpstartUrl','trackrUrl','linkedinUrl','dailyLimit']),
    scoutingPreferences: store.meta('scoutingPreferences'),
    inboxCoverage: pick('inboxCoverage', ['checkedAt','query','pages','messages','oldest','newest','complete','detail']),
  });
}
function records(store: Store): RecordItem[] {
  return (store.database.prepare('SELECT id,type,data FROM records ORDER BY id').all() as { id: string; type: string; data: string }[]).map(row => ({ ...row, data: JSON.parse(row.data) }));
}
function initialMetadata(): Metadata {
  // Use the actual constructor defaults, without loading personal seed records
  // or keeping a second hard-coded profile/settings definition in this module.
  const fresh = createStore(':memory:', false);
  try { return metadata(fresh); } finally { fresh.close(); }
}
function fingerprint(store: Store): string {
  return createHash('sha256').update(stable({ records: records(store), metadata: metadata(store) })).digest('hex');
}
function readBundle(value: unknown): Bundle {
  // Validate before any SQL writes; never execute imported tasks automatically.
  const serialized = JSON.stringify(value);
  if (!serialized || Buffer.byteLength(serialized) > MAX_BYTES) throw new ImportError(413, 'The archive exceeds the 25 MB import limit.');
  const normalized = JSON.parse(serialized);
  checkJson(normalized);
  const bundle = bundleSchema.parse(normalized) as Bundle;
  const ids = new Set<string>();
  for (const record of bundle.records) {
    if (ids.has(record.id)) throw new ImportError(400, `Duplicate record ID: ${record.id}.`);
    ids.add(record.id);
    record.data = schemas[record.type].parse(record.data) as Record<string, unknown>;
    if (record.data.id !== record.id) throw new ImportError(400, 'A record ID does not match its data.');
  }
  return bundle;
}
function links(record: RecordItem): { id: string; type: string }[] {
  const result: { id: string; type: string }[] = [];
  const link = (field: string, type: string) => { const value = record.data[field]; if (typeof value === 'string' && value) result.push({ id: value, type }); };
  if (['tasks','documents','practice','inbox_messages','inbox_events'].includes(record.type)) link('jobId', 'jobs');
  if (record.type === 'tasks') {link('practiceId', 'practice');link('contactId','contacts');}
  if(record.type==='contacts'){
    for(const id of (record.data.jobIds||[]) as string[])result.push({id,type:'jobs'});
    for(const draft of (record.data.outreachDrafts||[]) as {evidenceIds:string[]}[])for(const id of draft.evidenceIds)result.push({id,type:'evidence'});
  }
  if (record.type === 'practice') link('knowledgeId', 'knowledge');
  if (record.type === 'inbox_events') link('messageId', 'inbox_messages');
  if (record.type === 'documents' && Array.isArray(record.data.evidenceIds)) for (const value of record.data.evidenceIds) result.push({ id: String(value), type: 'evidence' });
  return result;
}
function uniqueKey(record: RecordItem): string | undefined {
  if (record.type === 'jobs' && record.data.url) return 'job-url:' + record.data.url;
  if (record.type === 'inbox_messages') return 'message:' + JSON.stringify([record.data.mailboxId, record.data.providerId]);
  return undefined;
}
function buildPlan(store: Store, bundle: Bundle, clock: number): Plan {
  const current = records(store);
  const existing = new Map(current.map(item => [item.id, item]));
  const incoming = new Map(bundle.records.map(item => [item.id, item]));
  for (const record of bundle.records) for (const relation of links(record)) {
    const target = incoming.get(relation.id) || existing.get(relation.id);
    if (!target || target.type !== relation.type) throw new ImportError(400, `Record ${record.id} has a missing or invalid ${relation.type} relationship.`);
  }
  const plan: Plan = { summary: { create: 0, skip: 0, conflict: 0 }, conflicts: [], warnings: [], records: [], metadata: {}, fingerprint: fingerprint(store), expires: clock + PREVIEW_TTL };
  const blocked = new Set<string>();
  const uniques = new Map(current.map(item => [uniqueKey(item), item.id]).filter((pair): pair is [string, string] => pair[0] !== undefined));
  let paused = 0;
  for (const original of bundle.records) {
    let record = original;
    if (record.type === 'tasks' && ['queued','running'].includes(String(record.data.status))) {
      record = { ...record, data: { ...record.data, restoredStatus: record.data.status, status: 'failed', error: 'Restored pending task. Review its provider and retry explicitly.', finishedAt: bundle.exportedAt } };
      paused++;
    }
    const previous = existing.get(record.id);
    if (previous) {
      if (stable(previous) === stable(record)) plan.summary.skip++;
      else { blocked.add(record.id); plan.conflicts.push(`Record ${record.id} differs from the existing record and will be preserved here.`); }
      continue;
    }
    const key = uniqueKey(record);
    if (key && uniques.has(key)) { blocked.add(record.id); plan.conflicts.push(`Record ${record.id} duplicates an existing or imported source identity and will not be added.`); continue; }
    if (key) uniques.set(key, record.id);
    plan.records.push(record);
  }
  // A new document must not silently attach to a different existing application
  // merely because an imported ID collided. Propagate conflicts to dependents.
  let changed = true;
  while (changed) {
    changed = false;
    plan.records = plan.records.filter(record => {
      if (!links(record).some(relation => blocked.has(relation.id))) return true;
      blocked.add(record.id); plan.conflicts.push(`Record ${record.id} depends on a conflicting record and will not be added.`); changed = true; return false;
    });
  }
  const currentMetadata = metadata(store) as Record<string, unknown>;
  const stoppedTasks=plan.records.filter(record=>record.type==='tasks'&&record.data.restoredStatus);
  for(const record of plan.records){
    if(record.type==='practice'&&['queued','running','reviewing','evaluating'].includes(String(record.data.status))&&stoppedTasks.some(task=>task.data.practiceId===record.id))record.data={...record.data,status:'failed'};
    if(record.type==='jobs'&&record.data.status==='preparing'&&stoppedTasks.some(task=>task.data.kind==='application'&&task.data.jobId===record.id))record.data={...record.data,status:'saved',needsReview:true};
  }
  const defaults = current.length === 0 ? initialMetadata() as Record<string, unknown> : {};
  for (const [key, value] of Object.entries(bundle.metadata)) {
    if (value === undefined) continue;
    if (currentMetadata[key] === undefined) plan.metadata[key] = value;
    else if (stable(currentMetadata[key]) === stable(value)) plan.summary.skip++;
    else if (defaults[key] !== undefined && stable(currentMetadata[key]) === stable(defaults[key])) {
      plan.metadata[key] = value;
      plan.warnings.push(`The untouched starter ${key} in this empty workspace will be replaced by the archived ${key}.`);
    } else plan.conflicts.push(`Workspace ${key} differs. The existing ${key} will be preserved.`);
  }
  plan.summary.create = plan.records.length + Object.keys(plan.metadata).length;
  plan.summary.conflict = plan.conflicts.length;
  if (paused) plan.warnings.push(`${paused} pending task(s) will require an explicit retry after restore; importing will not start provider calls.`);
  if (bundle.metadata.inboxCoverage) plan.warnings.push('Mailbox coverage is historical. This archive contains no mailbox credentials or paging token; reconnect and verify coverage before continuing a sync.');
  if (plan.conflicts.length) plan.warnings.push('Conflicting records and their dependent new records are excluded. Existing records are never replaced.');
  return plan;
}
function result(plan: Plan) { return { summary: plan.summary, conflicts: plan.conflicts, warnings: plan.warnings }; }

export function csvCell(value: unknown): string {
  let content = value === null || value === undefined ? '' : String(value);
  // Quote CSV syntax and neutralise formula triggers, including leading control
  // characters/whitespace that spreadsheet importers may discard.
  if (/^[\s\u0000-\u001f]*[=+\-@]/u.test(content) || /^[\t\r\n]/u.test(content)) content = "'" + content;
  return '"' + content.replace(/"/g, '""') + '"';
}

export function createPortabilityRouter(store: Store, options: { now?: () => number } = {}) {
  const router = express.Router();
  const clock = options.now || Date.now;
  const previews = new Map<string, Plan>();
  router.use(express.json({ limit: MAX_BYTES }));
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  router.get('/export', (_req, res) => {
    const bundle = readBundle({ format: 'stevie-workspace', version: 1, exportedAt: new Date(clock()).toISOString(), records: records(store), metadata: metadata(store) });
    res.setHeader('Content-Disposition', `attachment; filename="stevie-workspace-${bundle.exportedAt.slice(0,10)}.json"`);
    res.json(bundle);
  });
  router.get('/jobs.csv', (_req, res) => {
    const columns = ['id','company','title','location','status','source','url','deadline','description','notes','createdAt','updatedAt'];
    const rows = records(store).filter(record => record.type === 'jobs');
    const body = [columns.map(csvCell).join(','), ...rows.map(record => columns.map(column => csvCell(record.data[column])).join(','))].join('\r\n');
    res.setHeader('Content-Disposition', 'attachment; filename="stevie-applications.csv"');
    res.type('text/csv').send('\uFEFF' + body + '\r\n');
  });
  router.post('/preview', (req, res) => {
    // Accept the archive directly so the full 25 MB export fits the HTTP limit.
    // Keep the original envelope supported for existing callers.
    const value = req.body && Object.hasOwn(req.body, 'bundle') ? z.object({ bundle: z.unknown() }).strict().parse(req.body).bundle : req.body;
    const plan = buildPlan(store, readBundle(value), clock());
    for (const [key, saved] of previews) if (saved.expires <= clock()) previews.delete(key);
    while (previews.size >= 6) previews.delete(previews.keys().next().value!);
    const token = randomBytes(24).toString('base64url');
    previews.set(token, plan);
    res.json({ token, ...result(plan) });
  });
  router.post('/import', (req, res) => {
    const { token } = z.object({ token: z.string().min(20).max(100) }).strict().parse(req.body);
    const plan = previews.get(token);
    if (!plan || plan.expires <= clock()) { previews.delete(token); throw new ImportError(409, 'This preview expired or was already used. Preview the archive again.'); }
    previews.delete(token);
    store.transaction(() => {
      if (fingerprint(store) !== plan.fingerprint) throw new ImportError(409, 'The workspace changed after the preview. Preview the archive again before importing.');
      const insert = store.database.prepare('INSERT INTO records(id,type,data) VALUES(?,?,?)');
      for (const record of plan.records) insert.run(record.id, record.type, JSON.stringify(record.data));
      for (const [key, value] of Object.entries(plan.metadata)) store.setMeta(key, value);
    });
    res.json(result(plan));
  });
  router.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ImportError) { res.status(error.status).json({ error: error.message }); return; }
    if (error instanceof z.ZodError) { res.status(400).json({ error: 'Invalid or unsupported SteVie archive. Check its schema version, record types and required fields.' }); return; }
    if (error instanceof SyntaxError) { res.status(400).json({ error: 'The archive is not valid JSON.' }); return; }
    if ((error as { status?: number })?.status === 413) { res.status(413).json({ error: 'The archive exceeds the 25 MB import limit.' }); return; }
    res.status(500).json({ error: 'The archive operation failed. No partial import was saved.' });
  });
  return router;
}

