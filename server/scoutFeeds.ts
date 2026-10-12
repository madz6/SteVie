import {z} from 'zod';
import {suggestedTrack} from '../src/jobTracks.js';

export const feedSchema=z.object({company:z.string().trim().min(1).max(150),kind:z.enum(['greenhouse','lever','lever_eu']),board:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/),enabled:z.boolean()}).strict();
export type Feed=z.infer<typeof feedSchema>;
export type Posting={key:string;company:string;title:string;location:string;url:string;description:string;employmentType:'unknown';};
export const defaultFeeds:Feed[]=[{company:'Monzo',kind:'greenhouse',board:'monzo',enabled:true},{company:'BearingPoint Ireland',kind:'greenhouse',board:'bearingpoint',enabled:true},{company:'GoCardless',kind:'greenhouse',board:'gocardless',enabled:true}];
export function feedUrl(feed:Feed){
  feedSchema.parse(feed);
  return feed.kind==='greenhouse'?`https://boards-api.greenhouse.io/v1/boards/${feed.board}/jobs?content=true`:`https://${feed.kind==='lever_eu'?'api.eu.lever.co':'api.lever.co'}/v0/postings/${feed.board}?mode=json`;
}
export function plainText(value:unknown):string{
  return String(value??'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|apos|nbsp);/g,s=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&nbsp;':' '}[s]!)).replace(/&#(\d+);/g,(_,n)=>Number(n)<=0x10ffff?String.fromCodePoint(Number(n)):' ').replace(/\s+/g,' ').trim();
}
export function parseFeed(feed:Feed,body:unknown):Posting[]{
  const raw=feed.kind==='greenhouse'?z.object({jobs:z.array(z.unknown()).max(10000)}).parse(body).jobs:z.array(z.unknown()).max(10000).parse(body);
  return raw.map(value=>{
    const row=z.record(z.string(),z.unknown()).parse(value);
    const title=plainText(feed.kind==='greenhouse'?row.title:row.text);
    const location=plainText(feed.kind==='greenhouse'?(row.location as {name?:unknown})?.name:(row.categories as {location?:unknown})?.location);
    const url=String(feed.kind==='greenhouse'?row.absolute_url:row.hostedUrl);
    let parsed:URL;try{parsed=new URL(url);}catch{return null;}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password)return null;
    const description=plainText(feed.kind==='greenhouse'?row.content:[row.descriptionPlain??row.description,...(Array.isArray(row.lists)?row.lists.map((x:{text?:unknown;content?:unknown})=>`${x.text??''} ${x.content??''}`):[]),row.additionalPlain??row.additional].join(' '));
    if(!title||title.length>240||!location||location.length>200||description.length<80||description.length>45000)return null;
    return {key:`${feed.kind}:${feed.board}:${row.id}`,company:feed.company,title,location,url,description,employmentType:'unknown' as const};
  }).filter((row):row is Posting=>row!==null);
}
export async function fetchFeed(feed:Feed,fetcher=fetch):Promise<Posting[]>{
  // Fixed vendor origins, no user URLs, cookies, auth headers or redirects.
  const response=await fetcher(feedUrl(feed),{signal:AbortSignal.timeout(20000),redirect:'error',headers:{accept:'application/json'}});
  if(!response.ok)throw new Error(`Employer feed returned HTTP ${response.status}.`);
  const reader=response.body?.getReader();if(!reader)throw new Error('Employer feed was empty.');
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>6_000_000)throw new Error('Employer feed exceeded the size limit.');chunks.push(value);}}finally{await reader.cancel();}
  return parseFeed(feed,JSON.parse(Buffer.concat(chunks).toString('utf8')));
}
export function shortlistMatch(posting:Posting,locations:string[],roles:string[]){
  const title=posting.title.toLowerCase(),location=posting.location.toLowerCase();
  if(suggestedTrack(title)==='income'||/\b(senior|sr\.?|lead|principal|director|head|staff|vp|vice president)\b/i.test(title))return false;
  // Explicit regions only: a globally remote posting never implies local eligibility.
  return locations.some(term=>location.includes(term.toLowerCase()))&&roles.some(term=>title.includes(term.toLowerCase()));
}
