import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStore } from '../server/db.js';
import { ingestInbox } from '../server/inbox.js';

const input=process.argv[2];
if(!input)throw new Error('Provide the path to a SteVie mailbox snapshot JSON file.');
const path=resolve(input);
if(statSync(path).size>25_000_000)throw new Error('Snapshot exceeds the 25 MB import limit.');
const snapshot=JSON.parse(readFileSync(path,'utf8'));
const store=createStore(process.env.STEVIE_DB||resolve('data/stevie.db'));
try{console.log(JSON.stringify(ingestInbox(store,snapshot)));}finally{store.close();}
