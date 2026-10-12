import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createStore, type Store, type Job, type Task, type Document, type KnowledgeItem, type Contact, type Learning, type Evidence, type Activity, type ScoutTarget } from '../server/db.js';
import { createPortabilityRouter, csvCell } from '../server/portability.js';
import { installSecurity } from '../server/security.js';
import { classifyMessage, type InboxMessage } from '../server/inbox.js';
import { buildPractice } from '../server/practice.js';

const stamp = '2026-10-06T12:00:00.000Z';
function role(id = 'job-one'): Job {
  return { id, company: 'Example Employer', title: 'Analyst', location: 'Dublin', source: 'Fictional fixture', url: 'https://example.invalid/jobs/' + id, status: 'saved' as const, deadline: null, description: 'Fictional role description', notes: '', fit: null, fitReason: '', createdAt: stamp, updatedAt: stamp, needsReview: false };
}
function seed(store: Store) {
  store.save('jobs', {...role(),track:'career',employmentType:'full_time',mobileEase:'phone',mobileNote:'Fictional CV upload only'});
  store.setMeta('scoutingPreferences',{roles:['Analyst'],locations:['Dublin'],notes:'Fixture'});
  store.setMeta('scoutingSchedule',{enabled:true,automationId:'must-never-export'});
  const material: KnowledgeItem = { id: 'knowledge-one', title: 'Fictional case', kind: 'case', url: '', content: 'A fictional repair shop has five bookings. Estimate its capacity.', source: 'Fictional source', tags: ['fixture'], status: 'reviewed', createdAt: stamp, updatedAt: stamp };
  store.save('knowledge', material);
  store.save<Evidence>('evidence', { id: 'evidence-one', category: 'Project', text: 'Researched a fictional product.', source: 'Fictional source', status: 'verified' });
  store.save<Document>('documents', { id: 'document-one', jobId: 'job-one', kind: 'letter', title: 'Example letter', content: 'I researched a fictional product.', status: 'draft', createdAt: stamp, provider: 'codex', flags: [], generationFlags: ['Confirm availability.'], reviewChecks: [{flag: 'Confirm availability.', note: 'Checked the fictional start date against the test diary.', reviewedAt: stamp}], evidenceIds: ['evidence-one'], sourceSnapshots: [{ id: material.id, title: material.title, source: material.source, url: material.url, updatedAt: material.updatedAt, excerpt: material.content }] });
  store.save('practice', { ...buildPractice('case', role(), material), id: 'practice-one', createdAt: stamp, draftAnswer: 'Fictional saved draft' });
  store.save<Task>('tasks', { id: 'task-finished', kind: 'practice', jobId: 'job-one', practiceId: 'practice-one', status: 'done', error: null, createdAt: stamp, finishedAt: stamp, provider: 'codex', attempts: 1 });
  store.save<Contact>('contacts', { id: 'contact-one', name: 'Example Contact', company: 'Example Employer', role: 'Recruiter', email: 'contact@example.invalid', profileUrl: '', notes: 'Fictional fixture', followUp: '2026-10-08', status: 'new' });
  store.save<Learning>('learning', { id: 'learning-one', title: 'Fictional learning plan', skill: 'Research', status: 'planned', nextAction: 'Read the fixture', createdAt: stamp });
  store.save<Activity>('activity', { id: 'activity-one', text: 'Fictional test activity', createdAt: stamp });
  store.save<ScoutTarget>('scouts', { id: 'scout-one', kind: 'roles', source: 'web', query: 'Example roles', notes: 'Fictional fixture', status: 'planned', createdAt: stamp, updatedAt: stamp });
  for (const [index, subject] of ['Thank you for applying to Example Employer: Analyst', 'Thank you for applying to Example Employer', 'Unclassified message'].entries()) {
    const message = classifyMessage({ providerId: `provider-${index}`, mailboxId: 'mailbox-one', threadId: `thread-${index}`, subject, sender: 'sender@example.invalid', snippet: 'Fictional test correspondence.', receivedAt: stamp, url: 'https://example.invalid/message/' + index, direction: 'incoming' });
    store.save<InboxMessage>('inbox_messages', { ...message, id: `message-${index}`, jobId: index === 0 ? 'job-one' : null, reference: 'fixture-reference', location: 'Fictional location' });
  }
  store.setMeta('profile', { name: 'Example Candidate', headline: 'Analyst', location: 'Dublin' });
  store.setMeta('settings', { provider: 'claude-code', jumpstartUrl: '', trackrUrl: 'https://example.invalid/tracker', linkedinUrl: '', dailyLimit: 7 });
  store.setMeta('inboxCoverage', { checkedAt: stamp, query: 'fixture', pages: 1, messages: 3, oldest: stamp, newest: stamp, complete: true, detail: 'Fictional fixture', nextPageToken: 'opaque-paging-cursor' });
  store.setMeta('oauthTokens', { accessToken: 'must-never-export' });
  store.setMeta('dailyUsage', { date: '2026-10-06', count: 9 });
}
async function endpoint(store: Store, options: { now?: () => number } = {}) {
  const app = express();
  app.use('/portability', createPortabilityRouter(store, options));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/portability`;
  return {
    get: (path: string) => fetch(base + path),
    post: (path: string, body: unknown) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}
function emptyMetadata(store: Store) { store.database.prepare("DELETE FROM metadata WHERE key IN ('profile','settings','inboxCoverage')").run(); }

test('portable archive round trip preserves source references and inbox records but excludes access state', async () => {
  const source = createStore(':memory:', false); seed(source);
  const destination = createStore(':memory:', false);
  const from = await endpoint(source); const to = await endpoint(destination);
  try {
    const download = await from.get('/export'); assert.equal(download.status, 200); assert.match(download.headers.get('content-disposition')!, /attachment/);
    const bundle = await download.json();
    assert.equal(bundle.format, 'stevie-workspace'); assert.equal(bundle.version, 1);
    assert.deepEqual(Object.keys(bundle.metadata).sort(), ['inboxCoverage','profile','scoutingPreferences','settings']);
    assert.equal(bundle.metadata.inboxCoverage.nextPageToken, undefined);
    assert.ok(!JSON.stringify(bundle).includes('must-never-export'));
    assert.deepEqual(source.all<InboxMessage>('inbox_messages').map(message => message.confidence).sort(), ['high','low','medium']);
    const previewResponse = await to.post('/preview', { bundle }); assert.equal(previewResponse.status, 200);
    const preview = await previewResponse.json(); const total = bundle.records.length + 4;
    assert.deepEqual(preview.summary, { create: total, skip: 0, conflict: 0 });
    assert.ok(preview.warnings.some((warning: string) => warning.includes('untouched starter profile')));
    assert.equal(destination.all('jobs').length, 0);
    const imported = await to.post('/import', { token: preview.token }); assert.equal(imported.status, 200);
    assert.deepEqual((await imported.json()).summary, preview.summary);
    const restored = await to.get('/export').then(response => response.json());
    assert.deepEqual(restored.records, bundle.records); assert.deepEqual(restored.metadata, bundle.metadata);
    assert.equal(destination.meta('oauthTokens'), undefined);
    assert.equal((await to.post('/import', { token: preview.token })).status, 409);
    const again = await to.post('/preview', { bundle }).then(response => response.json());
    assert.deepEqual(again.summary, { create: 0, skip: total, conflict: 0 });
  } finally { await from.close(); await to.close(); source.close(); destination.close(); }
});

test('unknown schemas, duplicate IDs, credentials and broken relationships are rejected before writes', async () => {
  const source = createStore(':memory:', false); seed(source);
  const server = await endpoint(source);
  try {
    const bundle = await server.get('/export').then(response => response.json());
    assert.equal((await server.post('/preview', { bundle: { ...bundle, version: 999 } })).status, 400);
    assert.equal((await server.post('/preview', { bundle: { ...bundle, records: [...bundle.records, bundle.records[0]] } })).status, 400);
    assert.equal((await server.post('/preview', { bundle: { ...bundle, metadata: { ...bundle.metadata, accessToken: 'unsupported' } } })).status, 400);
    const broken = structuredClone(bundle);
    broken.records.find((record: any) => record.type === 'documents').data.jobId = 'missing-job';
    assert.equal((await server.post('/preview', { bundle: broken })).status, 400);
    assert.equal(source.all('jobs').length, 1);
  } finally { await server.close(); source.close(); }
});

test('malformed optional domain fields are rejected before they can reach the UI', async () => {
  const store = createStore(':memory:', false); seed(store);
  const server = await endpoint(store);
  try {
    const bundle = await server.get('/export').then(response => response.json());
    const invalid: [string, string, unknown][] = [
      ['inbox_messages','confidence',1], ['inbox_messages','kind','unsupported'], ['inbox_messages','reference',{}],
      ['documents','sourceSnapshots',{}], ['documents','generationFlags',[{}]],
      ['documents','sourceSnapshots',[{ ...bundle.records.find((record: any) => record.type === 'documents').data.sourceSnapshots[0], excerpt: {} }]],
      ['practice','stage','unsupported'], ['practice','stageAnswers',{ clarify: {} }], ['practice','draftAnswer',{}],
      ['practice','timer',{ mode: 'timed', elapsedSeconds: -1 }], ['practice','timer',{ mode: 'timed', elapsedSeconds: '12' }],
      ['practice','sourceLabel',{}], ['practice','synthetic','false'], ['practice','sourceSnapshot',{ content: {} }],
      ['jobs','unsupportedField',true],
    ];
    for (const [type, field, value] of invalid) {
      const malformed = structuredClone(bundle);
      malformed.records.find((record: any) => record.type === type).data[field] = value;
      assert.equal((await server.post('/preview', malformed)).status, 400, `${type}.${field}`);
    }
    const after = await server.get('/export').then(response => response.json());
    assert.deepEqual(after.records, bundle.records);
  } finally { await server.close(); store.close(); }
});

test('an edited profile in an empty workspace is preserved during restore', async () => {
  const source = createStore(':memory:', false); seed(source);
  const destination = createStore(':memory:', false);
  const localProfile = { name: 'Existing Candidate', headline: 'Locally edited profile', location: 'Example City' };
  destination.setMeta('profile', localProfile);
  const from = await endpoint(source); const to = await endpoint(destination);
  try {
    const bundle = await from.get('/export').then(response => response.json());
    const preview = await to.post('/preview', bundle).then(response => response.json());
    assert.equal(preview.summary.conflict, 1);
    assert.ok(preview.conflicts[0].includes('profile'));
    assert.equal((await to.post('/import', { token: preview.token })).status, 200);
    assert.deepEqual(destination.meta('profile'), localProfile);
    assert.deepEqual(destination.meta('settings'), bundle.metadata.settings);
  } finally { await from.close(); await to.close(); source.close(); destination.close(); }
});

test('the full 25 MB archive can be exported and previewed directly, and larger requests are rejected', async () => {
  const limit = 25 * 1024 * 1024;
  const store = createStore(':memory:', false); emptyMetadata(store);
  for (let index = 0; index < 131; index++) store.save<Activity>('activity', { id: `large-${index}`, text: 'x'.repeat(199_000), createdAt: stamp });
  store.save<Activity>('activity', { id: 'padding', text: '', createdAt: stamp });
  const server = await endpoint(store);
  try {
    const initial = await server.get('/export'); assert.equal(initial.status, 200);
    const bundle = await initial.json();
    const padding = bundle.records.find((record: any) => record.id === 'padding');
    padding.data.text = 'x'.repeat(limit - Buffer.byteLength(JSON.stringify(bundle)));
    assert.ok(padding.data.text.length < 200_000);
    store.save<Activity>('activity', padding.data);
    const download = await server.get('/export'); assert.equal(download.status, 200);
    const fullArchive = await download.text(); assert.equal(Buffer.byteLength(fullArchive), limit);
    assert.equal((await server.post('/preview', JSON.parse(fullArchive))).status, 200);
    padding.data.text += 'x';
    assert.equal((await server.post('/preview', bundle)).status, 413);
  } finally { await server.close(); store.close(); }
});

test('additive import preserves ID/URL conflicts and excludes dependent documents', async () => {
  const source = createStore(':memory:', false); seed(source);
  const destination = createStore(':memory:', false);
  destination.save('jobs', { ...role(), company: 'Existing local company' });
  destination.save('jobs', { ...role('local-other-id'), url: 'https://example.invalid/jobs/duplicate' });
  const originalProfile = JSON.stringify(destination.meta('profile'));
  const originalSettings = JSON.stringify(destination.meta('settings'));
  source.save('jobs', { ...role('import-other-id'), url: 'https://example.invalid/jobs/duplicate' });
  const from = await endpoint(source); const to = await endpoint(destination);
  try {
    const bundle = await from.get('/export').then(response => response.json());
    const preview = await to.post('/preview', { bundle }).then(response => response.json());
    assert.ok(preview.summary.conflict >= 4);
    assert.ok(preview.conflicts.some((message: string) => message.includes('depends on')));
    assert.equal((await to.post('/import', { token: preview.token })).status, 200);
    assert.equal(destination.get<Job>('jobs', 'job-one')?.company, 'Existing local company');
    assert.equal(destination.get('jobs', 'import-other-id'), undefined);
    assert.equal(destination.get('documents', 'document-one'), undefined);
    assert.equal(destination.get('evidence', 'evidence-one')?.id, 'evidence-one');
    assert.ok(JSON.stringify(destination.meta('profile')) === originalProfile);
    assert.ok(JSON.stringify(destination.meta('settings')) === originalSettings);
  } finally { await from.close(); await to.close(); source.close(); destination.close(); }
});

test('previews expire, reject stale workspace state and cannot partially import after a SQL failure', async () => {
  const source = createStore(':memory:', false); seed(source);
  const destination = createStore(':memory:', false); emptyMetadata(destination);
  let time = Date.parse(stamp);
  const from = await endpoint(source); const to = await endpoint(destination, { now: () => time });
  try {
    const bundle = await from.get('/export').then(response => response.json());
    const expired = await to.post('/preview', { bundle }).then(response => response.json());
    time += 10 * 60_000;
    assert.equal((await to.post('/import', { token: expired.token })).status, 409);
    const stale = await to.post('/preview', { bundle }).then(response => response.json());
    destination.save('jobs', role('concurrent-job'));
    assert.equal((await to.post('/import', { token: stale.token })).status, 409);
    assert.equal(destination.get('evidence', 'evidence-one'), undefined);
    const fresh = await to.post('/preview', { bundle }).then(response => response.json());
    destination.database.exec("CREATE TRIGGER reject_documents BEFORE INSERT ON records WHEN NEW.type='documents' BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
    assert.equal((await to.post('/import', { token: fresh.token })).status, 500);
    assert.equal(destination.get('evidence', 'evidence-one'), undefined);
    assert.equal(destination.get('jobs', 'job-one'), undefined);
    assert.equal(destination.meta('profile'), undefined);
  } finally { await from.close(); await to.close(); source.close(); destination.close(); }
});

test('restoring pending work requires explicit retry and preserves provider choice', async () => {
  const source = createStore(':memory:', false); source.save('jobs', {...role(),status:'preparing'});
  source.save('tasks', { id: 'task-one', kind: 'application', jobId: 'job-one', status: 'running', error: null, createdAt: stamp, finishedAt: null, provider: 'claude-code', attempts: 1 });
  const destination = createStore(':memory:', false);
  const from = await endpoint(source); const to = await endpoint(destination);
  try {
    const bundle = await from.get('/export').then(response => response.json());
    const preview = await to.post('/preview', { bundle }).then(response => response.json());
    assert.ok(preview.warnings.some((warning: string) => warning.includes('explicit retry')));
    assert.equal((await to.post('/import', { token: preview.token })).status, 200);
    const restored = destination.get<Task>('tasks', 'task-one');
    assert.equal(restored?.status, 'failed'); assert.equal(restored?.provider, 'claude-code');
    assert.equal(destination.get<Job>('jobs','job-one')?.status,'saved');
    assert.equal(destination.get<Job>('jobs','job-one')?.needsReview,true);
    assert.equal(destination.claimTask(), undefined);
  } finally { await from.close(); await to.close(); source.close(); destination.close(); }
});

test('CSV export neutralises formulas and preserves commas, quotes and multiline text', async () => {
  for (const value of ['=SUM(A1:A2)', '+123', '-123', '@test', ' \t=1+1', '\r\n=2+2']) assert.ok(csvCell(value).startsWith('"\''));
  assert.equal(csvCell('Safe, "quoted"\ntext'), '"Safe, ""quoted""\ntext"');
  const store = createStore(':memory:', false); store.save('jobs', { ...role(), company: '=1+1', notes: 'Line one\nLine two' });
  const server = await endpoint(store);
  try {
    const response = await server.get('/jobs.csv'); assert.equal(response.status, 200);
    const csv = await response.text(); assert.ok(csv.includes('"\'=1+1"')); assert.ok(csv.includes('"Line one\nLine two"'));
  } finally { await server.close(); store.close(); }
});

test('a public address requires a strong password even when bound to loopback', async () => {
  assert.throws(() => installSecurity(express(), { host: '127.0.0.1', port: 4317, publicUrl: 'https://workspace.example.invalid' }), /STEVIE_PASSWORD/);
  assert.throws(() => installSecurity(express(), { host: '127.0.0.1', port: 4317, publicUrl: 'https://workspace.example.invalid', password: 'short' }), /STEVIE_PASSWORD/);
  assert.throws(() => installSecurity(express(), { host: '127.0.0.1', port: 4317, publicUrl: 'http://workspace.example.invalid', password: 'a-long-fixture-password' }), /HTTPS/);
  const app = express(); app.use(express.json());
  installSecurity(app, { host: '127.0.0.1', port: 4317, publicUrl: 'https://workspace.example.invalid', password: 'a-long-fixture-password' });
  app.get('/api/private', (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const headers = { Host: 'workspace.example.invalid', 'Content-Type': 'application/json' };
    assert.equal((await fetch(base + '/api/private', { headers })).status, 401);
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers, body: JSON.stringify({ password: 'a-long-fixture-password' }) });
    assert.equal(login.status, 200); assert.match(login.headers.get('set-cookie')!, /; Secure/);
    const cookie = login.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await fetch(base + '/api/private', { headers: { ...headers, Cookie: cookie } })).status, 200);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
