import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { classifyMessage, type InboxMessage } from '../server/inbox.js';
import { createStore, now, type Job } from '../server/db.js';

// A conservative, repeatable repair. The before-image stays private in data/.
const store=createStore(process.env.STEVIE_DB||resolve('data/stevie.db'));
try{
  const before=store.all<InboxMessage>('inbox_messages');
  const messages=before.map(old=>({...old,...classifyMessage(old),id:old.id,jobId:old.jobId}));
  const affected=store.all<Job>('jobs').filter(job=>job.source==='Gmail recovery'&&job.needsReview&&!job.description&&job.notes.startsWith('Latest observed email event:')&&messages.some(message=>message.jobId===job.id)&&!messages.some(message=>message.jobId===job.id&&message.confidence==='high'));
  if(!process.argv.includes('--apply'))console.log(JSON.stringify({mode:'preview',messages:messages.length,recordsNeedingIdentityReview:affected.length}));
  else{
    const backup=resolve('data',`inbox-repair-${Date.now()}.json`);
    writeFileSync(backup,JSON.stringify({createdAt:now(),messages:before,jobs:affected}),{mode:0o600});
    store.transaction(()=>{
      for(const message of messages)store.save('inbox_messages',message);
      for(const job of affected)store.save('jobs',{...job,source:'Gmail recovery · uncertain identity',status:'unknown',notes:`Identity needs review: the original excerpt does not confidently establish this employer and exact role. The earlier inferred names are preserved for comparison with the original message.\n\n${job.notes}`,updatedAt:now()});
      if(affected.length)store.activity(`Marked ${affected.length} automatically recovered application identities as uncertain. Original observations and a local repair backup were preserved.`);
    });
    console.log(JSON.stringify({messages:messages.length,markedUncertain:affected.length,backup}));
  }
}finally{store.close();}
