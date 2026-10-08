import PDFDocument from 'pdfkit';
import type { Document, Evidence } from './db.js';
import { documentAuthor, privateDocumentFlags } from './import.js';

export function factualFlags(content:string, evidence:Evidence[],privateSeedPath?:string|null):string[] {
  const flags:string[]=privateDocumentFlags(content,privateSeedPath);
  if(/\[(?:insert|add|your|metric|confirm|number|TBD)[^\]]*\]|\bTODO\b|\bTBD\b/i.test(content))flags.push('The draft still contains a placeholder.');
  const contactNumbers=[process.env.STEVIE_UK_PHONE||'',process.env.STEVIE_OTHER_PHONE||''].join(' ');
  const allowedNumbers=new Set((evidence.filter(e=>e.status!=='unresolved').map(e=>e.text).join(' ')+' '+contactNumbers+' 2026 2027').match(/\b\d[\d,.]*%?/g)?.map(n=>n.replace(/,/g,''))||[]);
  const unknown=[...new Set((content.match(/\b\d[\d,.]*%?/g)||[]).filter(n=>!allowedNumbers.has(n.replace(/,/g,'')) && !/^[1-9]$/.test(n)))];
  if(unknown.length)flags.push(`Check numerical claims against evidence: ${unknown.slice(0,8).join(', ')}.`);
  return [...new Set(flags)];
}

function clean(text:string):string {
  return text.replace(/\*\*([^*]+)\*\*/g,'$1').replace(/__([^_]+)__/g,'$1').replace(/`([^`]+)`/g,'$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)').replace(/[\u200B-\u200D\uFEFF]/g,'').replace(/→/g,'to').replace(/✓/g,'yes');
}
type Line={text:string;heading:number;bullet:boolean};
function lines(content:string):Line[] {
  return content.replace(/\r/g,'').split('\n').filter(line=>!/^\s*---+\s*$/.test(line)).map(line=>({text:clean(line.replace(/^#{1,6}\s+/,'').replace(/^[-*]\s+/,'')).trim(),heading:line.match(/^(#{1,6})\s/)?.[1].length||0,bullet:/^[-*]\s+/.test(line)}));
}
const margins={top:30,bottom:28,left:40,right:40};
function measure(contentLines:Line[],fontSize:number):number {
  const pdf=new PDFDocument({size:'A4',margins});
  let height=0;
  for(const line of contentLines) {
    if(!line.text){height+=fontSize*0.32;continue;}
    const size=line.heading===1?fontSize+6:line.heading?fontSize+1.2:fontSize;
    pdf.font(line.heading?'Times-Bold':'Times-Roman').fontSize(size);
    height+=pdf.heightOfString(line.text,{width:pdf.page.width-margins.left-margins.right-(line.bullet?11:0),lineGap:1.1})+(line.heading?5:2);
  }
  pdf.end();
  return height;
}

export async function renderPdf(document:Pick<Document,'content'|'title'|'kind'>,privateSeedPath?:string|null):Promise<{buffer:Buffer;pages:number;fontSize:number;flags:string[]}> {
  const contentLines=lines(document.content);
  let fontSize=document.kind==='cv'?10.3:11;
  if(document.kind==='cv')while(fontSize>9.3&&measure(contentLines,fontSize)>783)fontSize=Math.round((fontSize-0.2)*10)/10;
  const author=documentAuthor(privateSeedPath);
  const pdf=new PDFDocument({size:'A4',margins,bufferPages:true,info:{Title:document.title,...(author?{Author:author}:{}),Creator:'SteVie'}});
  const chunks:Buffer[]=[];
  const finished=new Promise<Buffer>((resolve,reject)=>{pdf.on('data',(chunk:Buffer)=>chunks.push(chunk));pdf.on('end',()=>resolve(Buffer.concat(chunks)));pdf.on('error',reject);});
  for(const line of contentLines) {
    if(!line.text){pdf.y+=fontSize*0.32;continue;}
    const size=line.heading===1?fontSize+6:line.heading?fontSize+1.2:fontSize;
    pdf.font(line.heading?'Times-Bold':'Times-Roman').fontSize(size).fillColor('#111111');
    const width=pdf.page.width-margins.left-margins.right-(line.bullet?11:0);
    const height=pdf.heightOfString(line.text,{width,lineGap:1.1});
    if(pdf.y+Math.min(height,size*3)>pdf.page.height-margins.bottom)pdf.addPage();
    if(line.heading&&line.heading>1){pdf.moveTo(margins.left,pdf.y-2).lineTo(pdf.page.width-margins.right,pdf.y-2).lineWidth(0.45).stroke();}
    const startY=pdf.y;
    if(line.bullet){pdf.text('•',margins.left,startY,{lineBreak:false});pdf.text(line.text,margins.left+11,startY,{width,lineGap:1.1});}
    else pdf.text(line.text,margins.left,pdf.y,{width,lineGap:1.1});
    pdf.y+=line.heading?5:2;
  }
  const pages=pdf.bufferedPageRange().count;
  pdf.end();
  return {buffer:await finished,pages,fontSize,flags:document.kind==='cv'&&pages>1?[`CV is ${pages} pages. Shorten the content before applying; all text has been preserved.`]:[]};
}

export const safeFilename=(title:string)=>title.replace(/[^\p{L}\p{N} _-]/gu,'').trim().replace(/\s+/g,'_').slice(0,100)||'SteVie_document';
