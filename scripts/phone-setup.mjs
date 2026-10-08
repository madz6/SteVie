import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Prepares local configuration only. The user connects their devices and enables
// Tailscale Serve separately; this script never creates public internet access.
const installed=join(process.env.ProgramFiles||'C:\\Program Files','Tailscale','tailscale.exe');
const command=existsSync(installed)?installed:'tailscale';
const status=spawnSync(command,['status','--json'],{encoding:'utf8',windowsHide:true,shell:false,timeout:15000});
if(status.error||status.status!==0){
  console.error('Install Tailscale on this laptop and your iPhone, sign into the same account, then run npm run phone:setup again. Setup: https://tailscale.com/download');
  process.exit(1);
}
let state;
try{state=JSON.parse(status.stdout);}catch{throw new Error('Tailscale did not return a readable status. Open Tailscale and check its connection.');}
if(state.BackendState!=='Running')throw new Error('Connect this laptop in Tailscale before continuing.');
const hostname=String(state.Self?.DNSName||'').replace(/\.$/,'');
if(!/^[a-z0-9.-]+\.ts\.net$/i.test(hostname))throw new Error('No Tailscale HTTPS hostname is available. Enable MagicDNS in Tailscale and retry.');
const origin=`https://${hostname}`;
const envPath=resolve('.env');
const existing=existsSync(envPath)?readFileSync(envPath,'utf8'):'';
const parsed=process.env;
try{if(existsSync(envPath))process.loadEnvFile(envPath);}catch{throw new Error('Cannot read the existing .env. Correct it before setting up phone access.');}
if(parsed.STEVIE_PUBLIC_URL&&parsed.STEVIE_PUBLIC_URL!==origin)throw new Error('A different public URL is configured. Review .env before changing the existing deployment.');
if(parsed.STEVIE_PASSWORD&&parsed.STEVIE_PASSWORD.length<16)throw new Error('The existing workspace password must be at least 16 characters. Update it in .env first.');
if(parsed.STEVIE_HOST&&!['127.0.0.1','localhost','::1'].includes(parsed.STEVIE_HOST))throw new Error('This private setup expects a loopback host. Review STEVIE_HOST before continuing.');
const password=parsed.STEVIE_PASSWORD||randomBytes(24).toString('base64url');
const values={STEVIE_PUBLIC_URL:origin,STEVIE_PASSWORD:password,STEVIE_HOST:'127.0.0.1'};
let updated=existing;
for(const [key,value] of Object.entries(values)){
  const pattern=new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=.*$`,'m');
  const line=`${key}=${JSON.stringify(value)}`;
  updated=pattern.test(updated)?updated.replace(pattern,()=>line):`${updated.trimEnd()}\n${line}\n`;
}
writeFileSync(envPath,updated,{mode:0o600});
mkdirSync(resolve('data'),{recursive:true});
const instructions=resolve('data/phone-access.txt');
writeFileSync(instructions,`SteVie private phone access\n\nAddress: ${origin}\nWorkspace password: ${password}\n\nKeep this file private. Do not commit it or send it to anyone.\nBoth devices must be connected to your Tailscale network.\nKeep the laptop awake and SteVie running.\n`,{mode:0o600});
console.log(`Local configuration prepared. Address: ${origin}\nYour password is saved in data/phone-access.txt.\nStop the old SteVie server, then run npm run build and npm start.\nIn another terminal run: tailscale serve --bg http://127.0.0.1:${process.env.PORT||4317}\nFollow Tailscale's HTTPS setup prompt if shown.\nOn iPhone, connect Tailscale and open the address in Safari.\nTo stop sharing this service: tailscale serve --https=443 off`);
