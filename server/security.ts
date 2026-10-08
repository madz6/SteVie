import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction, Express } from 'express';

const sessions = new Map<string, number>();
const attempts = new Map<string, {count:number,until:number}>();
const loopbacks = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
export function installSecurity(app: Express, options: {host:string,port:number,publicUrl?:string,password?:string}) {
  const { host, port, publicUrl, password } = options;
  const localOnly = host === '127.0.0.1' || host === '::1' || host === 'localhost';
  // A local reverse proxy also reaches us over loopback. A public origin must
  // therefore require authentication regardless of the interface we bind to.
  const publicAccess = !localOnly || Boolean(publicUrl);
  if (publicAccess && (!password || password.length < 16)) throw new Error('Remote access requires STEVIE_PASSWORD with at least 16 characters.');
  let publicOrigin: URL | undefined;
  try { if (publicUrl) publicOrigin = new URL(publicUrl); } catch { throw new Error('STEVIE_PUBLIC_URL must be a valid HTTPS origin.'); }
  if (publicAccess && (!publicOrigin || publicOrigin.protocol !== 'https:' || publicOrigin.username || publicOrigin.password || publicOrigin.pathname !== '/' || publicOrigin.search || publicOrigin.hash)) throw new Error('Remote access requires an HTTPS STEVIE_PUBLIC_URL origin behind a TLS reverse proxy.');
  const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
  if (publicOrigin) allowedHosts.add(publicOrigin.host);
  const expectedHash = password ? scryptSync(password, 'stevie-private-workspace', 64) : undefined;
  const secureCookie = Boolean(publicUrl?.startsWith('https://'));
  app.disable('x-powered-by');
  app.use((req:Request,res:Response,next:NextFunction) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control','no-store');
    const hostHeader=req.headers.host||'';
    const hostName=hostHeader.startsWith('[')?hostHeader.slice(1).split(']')[0]:hostHeader.split(':')[0];
    const localHostMatch=localOnly&&loopbacks.has(hostName);
    if (!allowedHosts.has(hostHeader)&&!localHostMatch) return res.status(403).json({error:'This host is not configured for SteVie.'});
    if (req.headers.origin) {
      let originHost = '';
      try {originHost = new URL(req.headers.origin).host;} catch { /* invalid origin */ }
      if (!allowedHosts.has(originHost)) return res.status(403).json({error:'Cross-site requests are not permitted.'});
    }
    next();
  });
  app.post('/api/auth/login',(req:Request,res:Response) => {
    const ip = req.socket.remoteAddress || 'unknown';
    const attempt = attempts.get(ip);
    if (attempt && attempt.until>Date.now() && attempt.count>=5) return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});
    const supplied = typeof req.body?.password==='string' ? req.body.password.slice(0,1024) : '';
    if (!expectedHash || !timingSafeEqual(scryptSync(supplied,'stevie-private-workspace',64),expectedHash)) {
      attempts.set(ip,{count:attempt && attempt.until>Date.now()?attempt.count+1:1,until:Date.now()+900_000});
      return res.status(401).json({error:'That password did not match.'});
    }
    attempts.delete(ip);
    const token=randomBytes(32).toString('base64url');
    sessions.set(token,Date.now()+7*86400_000);
    res.setHeader('Set-Cookie',`stevie_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secureCookie?'; Secure':''}`);
    res.json({ok:true});
  });
  app.use((req:Request,res:Response,next:NextFunction)=>{
    if (req.path==='/api/health') return next();
    if (localOnly && !publicAccess && !password && loopbacks.has(req.socket.remoteAddress || '')) return next();
    const token=(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('stevie_session='))?.slice(15);
    const expires=token?sessions.get(token):undefined;
    if (expires && expires>Date.now()) return next();
    if(token) sessions.delete(token);
    if(req.path.startsWith('/api/')) return res.status(401).json({error:'Sign in to your SteVie workspace.'});
    res.status(401).type('html').send(loginHtml);
  });
  app.post('/api/auth/logout',(req,res)=>{
    const token=(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('stevie_session='))?.slice(15);
    if(token) sessions.delete(token);
    res.setHeader('Set-Cookie','stevie_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    res.json({ok:true});
  });
}
const loginHtml=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · SteVie</title><style>body{background:#f5f4ef;color:#242a27;font:16px system-ui;margin:0;display:grid;min-height:100dvh;place-items:center}main{width:min(360px,85vw)}h1{font-size:38px;letter-spacing:-2px}p{color:#626961;line-height:1.5}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;border:1px solid #ccc;border-radius:8px;margin-top:12px}button{background:#245641;color:white;cursor:pointer}#error{color:#b2442e}</style><main><h1>SteVie<span style="color:#648476">.</span></h1><p>Your job search, in one place.</p><form id="login"><label for="password">Workspace password</label><input id="password" type="password" autocomplete="current-password" required><button>Open workspace</button><p id="error" role="alert"></p></form></main><script>document.getElementById('login').addEventListener('submit',async e=>{e.preventDefault();const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:document.getElementById('password').value})});if(r.ok)location.reload();else document.getElementById('error').textContent=(await r.json()).error;});</script></html>`;
