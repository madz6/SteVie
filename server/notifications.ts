import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Router } from 'express';
import webpush from 'web-push';
import { z } from 'zod';

export function validPushEndpoint(value:string): boolean {
  try { const u=new URL(value);return u.protocol==='https:' && !u.username && !u.password && (!u.port || u.port==='443') && ['fcm.googleapis.com','push.services.mozilla.com','push.apple.com','notify.windows.com'].some(host=>u.hostname===host || u.hostname.endsWith('.'+host)); } catch{return false;}
}
export function createNotifications(dataDir=resolve('data')) {
  mkdirSync(dataDir,{recursive:true});
  const keyPath=resolve(dataDir,'push-keys.json');
  let keys:{publicKey:string,privateKey:string};
  if(existsSync(keyPath)) keys=JSON.parse(readFileSync(keyPath,'utf8'));
  else {keys=webpush.generateVAPIDKeys();writeFileSync(keyPath,JSON.stringify(keys),{mode:0o600});}
  webpush.setVapidDetails(process.env.STEVIE_PUSH_CONTACT || 'mailto:notifications@stevie.local',keys.publicKey,keys.privateKey);
  const db=new DatabaseSync(resolve(dataDir,'notifications.db'));
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS subscriptions(endpoint TEXT PRIMARY KEY, payload TEXT NOT NULL, created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS delivered(tag TEXT PRIMARY KEY, sent_at TEXT NOT NULL);');
  const count=()=>Number((db.prepare('SELECT count(*) n FROM subscriptions').get() as {n:number}).n);
  async function send(title:string,body:string,url='/',tag?:string) {
    if(tag && db.prepare('SELECT tag FROM delivered WHERE tag=?').get(tag)) return 0;
    let sent=0;
    const rows=db.prepare('SELECT endpoint,payload FROM subscriptions').all() as {endpoint:string,payload:string}[];
    for(const row of rows){
      try {await webpush.sendNotification(JSON.parse(row.payload),JSON.stringify({title,body,url,tag:tag || 'stevie'}),{TTL:3600,timeout:10000});sent++;}
      catch(error){const status=(error as {statusCode?:number}).statusCode;if(status===404 || status===410) db.prepare('DELETE FROM subscriptions WHERE endpoint=?').run(row.endpoint);}
    }
    if(sent && tag) db.prepare('INSERT OR IGNORE INTO delivered(tag,sent_at) VALUES(?,?)').run(tag,new Date().toISOString());
    return sent;
  }
  const router=Router();
  router.get('/status',(_req,res)=>res.json({supported:true,publicKey:keys.publicKey,subscriptions:count(),configured:true,detail:count()>0?'Notifications are enabled on a registered device.':'On iPhone, open your HTTPS SteVie address in Safari, add it to the Home Screen, then enable notifications here.'}));
  router.post('/subscribe',(req,res)=>{
    const parsed=z.object({subscription:z.object({endpoint:z.string().refine(validPushEndpoint,'Unsupported push service'),expirationTime:z.number().nullable().optional(),keys:z.object({p256dh:z.string().min(20).max(256),auth:z.string().min(10).max(128)})})}).safeParse(req.body);
    if(!parsed.success) return res.status(400).json({error:'A valid browser push subscription is required.'});
    const {subscription}=parsed.data;
    db.prepare('INSERT INTO subscriptions(endpoint,payload,created_at) VALUES(?,?,?) ON CONFLICT(endpoint) DO UPDATE SET payload=excluded.payload').run(subscription.endpoint,JSON.stringify(subscription),new Date().toISOString());
    res.json({ok:true});
  });
  router.post('/test',async(_req,res)=>{
    if(!count()) return res.status(409).json({error:'Enable notifications on this device first.'});
    const sent=await send('SteVie is ready','Application updates and reminders will arrive here.');
    if(!sent) return res.status(502).json({error:'The push service did not accept the notification. Re-enable notifications and try again.'});
    res.json({ok:true,sent});
  });
  return {router,send,close:()=>db.close()};
}
