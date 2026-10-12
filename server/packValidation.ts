import {type Store,type Task,type Document,type Job,now} from './db.js';
/** Completeness is separate from factual review. Reject unusable packs atomically. */
export function assertCompletePack(pack:{cv:string;letter:string;answers:string;brief:string;evidenceIds:string[];flags:string[]},validIds:Set<string>) {
  for(const kind of ['cv','letter','answers','brief'] as const){
    const body=pack[kind].replace(/\[evidence:[^\]]+\]/g,'').trim();
    if(body.length<80||/^(?:#+\s*)?(?:placeholder|todo|tbd|tbc|coming soon|not generated)[.!\s]*$/i.test(body))
      throw new Error(`Incomplete ${kind} returned by the provider. The entire pack was rejected; no documents were saved.`);
  }
  if(!pack.evidenceIds.length||pack.evidenceIds.some(id=>!validIds.has(id))||pack.flags.some(flag=>/^(?:Unknown evidence reference|Unresolved evidence was used)/i.test(flag)))
    throw new Error('The provider returned missing or invalid evidence references. The entire pack was rejected; no documents were saved.');
}

export function quarantineIncompleteHistory(store:Store){
  // Keep the old text for diagnosis; never delete it or rewrite a user's edits.
  store.transaction(()=>{
    for(const task of store.all<Task>('tasks').filter(t=>t.kind==='application'&&t.status==='done'&&t.finishedAt)){
      const docs=store.all<Document>('documents').filter(d=>d.jobId===task.jobId&&d.createdAt>=task.createdAt&&d.createdAt<=task.finishedAt!);
      if(!docs.some(d=>!(d.generationFlags??d.flags).some(f=>f.startsWith('Incomplete generated pack:'))&&(d.content.trim().length<80||/^placeholder[.!\s]*$/i.test(d.content.trim()))))continue;
      const warning='Incomplete generated pack: placeholder or missing document content. Prepare a replacement before approval.';
      for(const doc of docs)store.save('documents',{...doc,status:'needs_review',reviewChecks:[],flags:[...new Set([...doc.flags,warning])],generationFlags:[...new Set([...(doc.generationFlags??doc.flags),warning])]});
      store.save('tasks',{...task,status:'failed',error:warning});
      const job=task.jobId?store.get<Job>('jobs',task.jobId):undefined;
      if(job)store.save('jobs',{...job,needsReview:true,status:job.status==='ready'?'saved':job.status,updatedAt:now()});
      store.activity('An earlier incomplete application pack was quarantined. Its done label has been corrected.');
    }
  });
}
