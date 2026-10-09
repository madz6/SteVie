import {readFileSync} from 'node:fs';
try{process.loadEnvFile('.env');}catch{}
const base=`http://127.0.0.1:${process.env.PORT||4317}/api`;
let cookie='';
async function request(path,method='GET',body){
  const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||`SteVie returned ${response.status}`);
  if(path==='/auth/login')cookie=response.headers.get('set-cookie')?.split(';')[0]||'';
  return data;
}
try{
  if(process.env.STEVIE_PASSWORD)await request('/auth/login','POST',{password:process.env.STEVIE_PASSWORD});
  const argument=process.argv[2];
  if(argument==='--context'){
    const data=await request('/bootstrap');
    console.log(JSON.stringify({scouting:await request('/scouting'),profile:data.profile,jobs:data.jobs.map(({id,company,title,location,url,status,track})=>({id,company,title,location,url,status,track})),tasks:data.tasks,evidenceCount:data.evidence.length}));
  }else if(argument==='--preferences'||argument==='--schedule'){
    const input=JSON.parse(readFileSync(process.argv[3],'utf8'));
    console.log(JSON.stringify(await request('/scouting/'+argument.slice(2),'PUT',input)));
  }else{
    if(!argument)throw new Error('Supply a researched scout JSON file, or use --context.');
    const result=await request('/scouting/import','POST',JSON.parse(readFileSync(argument,'utf8')));
    console.log(JSON.stringify(result));
  }
}catch(error){console.error(error.message);process.exitCode=1;}
finally{if(cookie)await request('/auth/logout','POST',{}).catch(()=>{});}
