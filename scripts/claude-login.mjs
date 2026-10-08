import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Uses the official client already installed for this workspace without changing user PATH.
const client=resolve('.runtime/claude/node_modules/@anthropic-ai/claude-code/bin/claude.exe');
if(!existsSync(client)){
  console.error('Claude Code is not installed in this workspace. Install the official client, then run claude auth login. See README setup.');
  process.exitCode=1;
}else{
  const child=spawn(client,['auth','login'],{stdio:'inherit',shell:false,windowsHide:true});
  child.on('error',error=>{console.error(error.message);process.exitCode=1;});
  child.on('exit',code=>{process.exitCode=code??1;});
}
