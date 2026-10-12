import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApi, startWorker } from './api.js';
import { installSecurity } from './security.js';
import { createNotifications } from './notifications.js';

try {process.loadEnvFile('.env');} catch {/* environment file is optional */}
const host=process.env.STEVIE_HOST || '127.0.0.1';
const port=Number(process.env.PORT || 4317);
const app=express();
app.use(express.json({limit:'25mb'}));
installSecurity(app,{host,port,publicUrl:process.env.STEVIE_PUBLIC_URL,password:process.env.STEVIE_PASSWORD});
app.get('/api/health',(_req,res)=>res.json({ok:true,app:'stevie',schemaVersion:2}));
const notifications=createNotifications(process.env.STEVIE_DATA_DIR || resolve('data'));
app.use('/api/notifications',notifications.router);
app.use('/api',createApi());
app.use('/api',(_req,res)=>res.status(404).json({error:'That action is not available.'}));
const dist=resolve('dist');
const production=process.env.NODE_ENV==='production'||process.argv.includes('--production');
if(production&&!existsSync(resolve(dist,'index.html')))throw new Error('Production build missing. Run npm run build before npm start.');
if(production){
  app.use(express.static(dist,{maxAge:0}));
  app.get('/{*path}',(_req,res)=>res.sendFile(resolve(dist,'index.html')));
} else {
  const {createServer}=await import('vite');
  const vite=await createServer({server:{middlewareMode:true},appType:'spa'});
  app.use(vite.middlewares);
}
app.use((error:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(res.headersSent)return;
  const status=(error as {status?:number}).status;
  res.status(status && status>=400 && status<500?status:500).json({error:status===400?'The request could not be read.':'Something went wrong. Your saved work is still available.'});
});
let stop=()=>{};
const server=app.listen(port,host,error=>{
  if(error){notifications.close();console.error(`SteVie could not listen on ${host}:${port}. Stop the older server before starting this build.`);process.exit(1);return;}
  console.log(`SteVie is running at ${process.env.STEVIE_PUBLIC_URL||`http://${host}:${port}`}`);
  stop=startWorker({onComplete:async event=>{
  await notifications.send(event.kind==='failure'?'SteVie · needs attention':'SteVie · update',event.text,event.kind==='scout'?'/?view=scout':event.kind==='practice'?'/?view=practice':event.jobId?`/?view=applications&job=${event.jobId}`:'/?view=scout',`${event.kind}:${event.jobId || ''}:${event.text}`);
  }});
});
function shutdown(){stop();notifications.close();server.close(()=>process.exit(0));}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
