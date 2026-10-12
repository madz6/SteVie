import test from 'node:test';
import assert from 'node:assert/strict';
import {peerReview} from '../server/peerReview.js';
import {mobileRank} from '../src/mobileApplications.js';
const input={kind:'numerical',prompt:'Fictional calculation',answer:'I divide ten by two to obtain five.',context:'Fixture context',provider:'codex'};
test('peer review preserves both attributed opinions and independently sends the original answer',async()=>{
 const calls:any[]=[];let saved='';
 const result=await peerReview(input,'claude-code',async value=>{calls.push(value);return {feedback:value.provider==='codex'?'First feedback':'Disagrees with the first score',score:value.provider==='codex'?70:60};},value=>{saved=value;});
 assert.equal(calls.length,2);assert.equal(calls[1].answer,input.answer);assert.equal(calls[1].provider,'claude-code');assert.match(calls[1].context,/another model's unverified opinion/);assert.match(saved,/pending/);assert.match(result.feedback,/Codex 70\/100; Claude Code 60\/100/);assert.equal(result.score,70);
});
test('second reviewer failure preserves first opinion and never switches providers',async()=>{
 let saved='';let calls=0;
 await assert.rejects(peerReview(input,'claude-code',async value=>{calls++;if(value.provider==='claude-code')throw new Error('Claude unavailable');return {feedback:'Useful first opinion',score:50};},value=>{saved=value;}),/Claude unavailable/);
 assert.equal(calls,2);assert.match(saved,/Useful first opinion/);
});
test('mobile ordering keeps untested application flows distinct from laptop-rated flows',()=>{
 assert.deepEqual([{mobileEase:'laptop' as const},{},{mobileEase:'phone' as const}].sort((a,b)=>mobileRank(a)-mobileRank(b)).map(x=>x.mobileEase??'unknown'),['phone','unknown','laptop']);
});
