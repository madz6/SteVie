import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAiService } from '../server/ai.js';

test('Claude structured usage failures report the limit without exposing raw output',async()=>{
  const root=await mkdtemp(join(tmpdir(),'stevie-limit-test-'));
  try{
    const service=createAiService({runtimeRoot:root,env:{PATH:process.env.PATH},resolveCommand:async()=>({command:'fixture-client',prefix:[]}),run:async request=>request.args.includes('auth')?{code:0,stdout:JSON.stringify({loggedIn:true,authMethod:'claude.ai'}),stderr:''}:{code:0,stdout:JSON.stringify({is_error:true,result:"You've hit your limit. fixture-private-detail"}),stderr:''}});
    const result=await service.testProvider('claude-code');
    assert.equal(result.status,'unavailable');assert.match(result.detail,/usage or credit limit/);assert.doesNotMatch(result.detail,/fixture-private-detail/);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('application schema permits only supplied usable evidence IDs and inline inventions remain flagged',async()=>{
  const root=await mkdtemp(join(tmpdir(),'stevie-evidence-test-'));
  try{
    let calls=0;
    const service=createAiService({runtimeRoot:root,env:{PATH:process.env.PATH},resolveCommand:async()=>({command:'fixture-client',prefix:[]}),run:async request=>{
      if(request.args.includes('auth'))return {code:0,stdout:JSON.stringify({loggedIn:true,authMethod:'claude.ai'}),stderr:''};
      calls++;
      const schema=JSON.parse(request.args[request.args.indexOf('--json-schema')+1]);
      assert.deepEqual(schema.properties.evidenceIds.items.enum,['known']);
      return {code:0,stderr:'',stdout:JSON.stringify({structured_output:{cv:'Built a fictional analysis. [evidence:invented]',letter:'I built a fictional analysis. [evidence:known]',answers:'I built a fictional analysis. [evidence:known]',brief:'Requirements need review.',fit:30,fitReason:'Limited evidence.',evidenceIds:['known'],flags:[]}})};
    }});
    const input={provider:'claude-code',job:{company:'Fixture',title:'Analyst',description:'Fictional role',location:'Dublin'},profile:{name:'Example',headline:'Analyst',location:'Dublin'},context:'',evidence:[{id:'known',category:'project',text:'Built a fictional analysis.',source:'Fixture',status:'verified' as const},{id:'excluded',category:'project',text:'Unresolved fact.',source:'Fixture',status:'unresolved' as const}]};
    const result=await service.generateApplication(input);
    assert.ok(result.flags.some(f=>f.startsWith('Unknown evidence reference: invented')));
    await assert.rejects(service.generateApplication({...input,evidence:[]}),/Add usable candidate evidence/);
    assert.equal(calls,1);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('Codex native probe uses valid feature switches and never inherits metered API keys',async()=>{
  const root=await mkdtemp(join(tmpdir(),'stevie-ai-test-'));
  let probes=0;
  try{
    const service=createAiService({runtimeRoot:root,env:{OPENAI_API_KEY:'fixture-not-a-real-key',ANTHROPIC_API_KEY:'fixture-not-a-real-key',PATH:process.env.PATH},resolveCommand:async()=>({command:'fixture-client',prefix:[]}),run:async request=>{
      assert.equal(request.env.OPENAI_API_KEY,undefined);assert.equal(request.env.ANTHROPIC_API_KEY,undefined);
      if(request.args.includes('login'))return {code:0,stdout:'Logged in using ChatGPT',stderr:''};
      assert.ok(request.args.includes('--ignore-user-config'));
      assert.ok(!request.args.includes('agents.enabled=false'));
      const multi=request.args.indexOf('multi_agent');assert.equal(request.args[multi-1],'--disable');
      assert.equal(request.args[request.args.indexOf('--sandbox')+1],'read-only');
      await writeFile(request.args[request.args.indexOf('--output-last-message')+1],'{"ok":true}');
      probes++;return {code:0,stdout:'',stderr:''};
    }});
    assert.equal((await service.testProvider('codex')).status,'connected');assert.equal(probes,1);
  }finally{await rm(root,{recursive:true,force:true});}
});

test('Claude structured responses are allowed without granting built-in tools',async()=>{
  const root=await mkdtemp(join(tmpdir(),'stevie-claude-test-'));
  try{
    const service=createAiService({runtimeRoot:root,env:{PATH:process.env.PATH},resolveCommand:async()=>({command:'fixture-client',prefix:[]}),run:async request=>{
      if(request.args.includes('auth'))return {code:0,stdout:JSON.stringify({loggedIn:true,authMethod:'claude.ai'}),stderr:''};
      assert.equal(request.args[request.args.indexOf('--tools')+1],'');
      assert.equal(request.args[request.args.indexOf('--allowedTools')+1],'StructuredOutput');
      assert.ok(request.args.includes('--restricted'));assert.ok(request.args.includes('--safe-mode'));
      assert.equal(request.args[request.args.indexOf('--permission-mode')+1],'dontAsk');
      assert.equal(request.args.includes('--disallowedTools'),false);
      return {code:0,stdout:JSON.stringify({is_error:false,structured_output:{ok:true}}),stderr:''};
    }});
    assert.equal((await service.testProvider('claude-code')).status,'connected');
  }finally{await rm(root,{recursive:true,force:true});}
});
