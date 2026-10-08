import test from 'node:test';
import assert from 'node:assert/strict';
import { parseKnowledgeUpload, retrieveKnowledge } from '../server/knowledge.js';
import { buildPractice } from '../server/practice.js';
import { createStore, type KnowledgeItem } from '../server/db.js';

test('knowledge import turns ChatGPT mapping exports into reviewable source text', async () => {
  const exportData = [{ id: 'chat-1', title: 'Fictional case notes', current_node: '2', mapping: {
    '1': { parent: null, message: { author: { role: 'user' }, content: { parts: ['Clarify the objective.'] } } },
    '2': { parent: '1', message: { author: { role: 'assistant' }, content: { parts: ['State the decision and the constraint.'] } } },
  } }];
  const result = await parseKnowledgeUpload({ name: 'conversations.json', contentBase64: Buffer.from(JSON.stringify(exportData)).toString('base64') });
  assert.equal(result.records.length, 1);
  assert.match(result.records[0].content, /Clarify the objective/);
  assert.match(result.records[0].content, /State the decision/);
  assert.equal(result.records[0].status, 'unreviewed');
});

test('source-based practice replaces the synthetic exercise and keeps a bounded snapshot', () => {
  const material:KnowledgeItem = { id: 'case-source', title: 'Fictional supplied case', kind: 'case', url: 'https://example.invalid/case', content: 'A supplied case asks the candidate to compare two pricing options and identify one assumption to test.', source: 'Fictional training pack', tags: ['case'], status: 'reviewed', createdAt: '2026-10-06T00:00:00.000Z', updatedAt: '2026-10-06T00:00:00.000Z' };
  const practice = buildPractice('case', undefined, material);
  assert.equal(practice.synthetic, false);
  assert.match(practice.prompt, /A supplied case asks/);
  assert.doesNotMatch(practice.prompt, /repair service has 12,000 annual bookings/);
  assert.equal(practice.sourceSnapshot?.id, material.id);
});

test('retrieval only returns reviewed source text and marks truncation', () => {
  const store = createStore(':memory:', false);
  const base = { kind: 'document' as const, url: '', source: 'Fictional fixture', tags: ['pricing'], createdAt: '2026-10-06T00:00:00.000Z', updatedAt: '2026-10-06T00:00:00.000Z' };
  store.save('knowledge', { ...base, id: 'reviewed', title: 'Pricing notes', content: 'Pricing evidence and market assumptions.', status: 'reviewed' });
  store.save('knowledge', { ...base, id: 'unreviewed', title: 'Unreviewed notes', content: 'Do not retrieve this source.', status: 'unreviewed' });
  const result = retrieveKnowledge(store, 'pricing market', 400);
  assert.equal(result.sources.length, 1);
  assert.match(result.context, /Pricing notes/);
  assert.doesNotMatch(result.context, /Do not retrieve/);
  store.close();
});
