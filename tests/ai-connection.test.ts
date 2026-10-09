import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAiService } from '../server/ai.js';

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
