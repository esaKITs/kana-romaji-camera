import assert from 'node:assert/strict';
const base=process.env.TEST_URL,expected=process.env.GITHUB_SHA;
assert.ok(base&&expected,'TEST_URL and GITHUB_SHA are required');
let last='not fetched';
for(let attempt=0;attempt<30;attempt++){
 try{
  const url=new URL('deployment.json',base);url.searchParams.set('revision',expected);
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(response.ok){const data=await response.json();if(data.commit===expected){console.log('Verified public revision '+data.commit);process.exit(0);}last='revision '+data.commit;}
  else last='HTTP '+response.status;
 }catch(e){last=e.message;}
 await new Promise(resolve=>setTimeout(resolve,3000));
}
throw Error('Public Pages revision did not become available: '+last);
