import {createServer} from 'node:http';import {readFile,writeFile,stat} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve('dist'),fixtures=resolve('tests/fixtures');
const server=createServer(async(req,res)=>{try{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const file=p.startsWith('/test-fixtures/')?resolve(fixtures,p.slice(15)):resolve(root,'.'+(p==='/'?'/index.html':p));if(!(file.startsWith(root+'/')||file.startsWith(fixtures+'/')))throw Error('path');const bytes=await readFile(file);res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.png':'image/png'})[extname(file)]||'application/octet-stream'}).end(bytes)}catch(e){res.writeHead(404).end('Not found')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const engineName=process.env.BROWSER||'chromium';const proxyUrl=process.env.TEST_URL&&process.env.HTTPS_PROXY?new URL(process.env.HTTPS_PROXY):null;const proxy=proxyUrl?{server:proxyUrl.origin,username:decodeURIComponent(proxyUrl.username),password:decodeURIComponent(proxyUrl.password)}:undefined;
const browser=await (engineName==='webkit'?webkit:chromium).launch(engineName==='webkit'?{executablePath:process.env.WEBKIT_PATH,headless:true}:{proxy,executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
const results=[];
try{
 for(const device of (engineName==='webkit'?['iphone-layout']:['android-layout','iphone-layout'])){
  const context=await browser.newContext({viewport:device==='iphone-layout'?{width:390,height:844}:{width:412,height:915},isMobile:true,hasTouch:true,ignoreHTTPSErrors:!!process.env.TEST_URL});
  const page=await context.newPage(),errors=[],network=[],uploads=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('request',r=>{network.push(r.url());if(r.method()!=='GET')uploads.push(r.url());});
  const fixtureData=Object.fromEntries(await Promise.all(['white','black'].map(async name=>[name,'data:image/png;base64,'+(await readFile(resolve(fixtures,name+'.png'))).toString('base64')])));
  await page.addInitScript(({fixtureData})=>{
   const fills=[];window.drawnRomaji=fills;const original=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(t,...args){if(this.canvas.id==='overlay'){fills.push(t);if(fills.length>1000)fills.shift();}return original.call(this,t,...args);};
   const videoCanvas=document.createElement('canvas');videoCanvas.width=960;videoCanvas.height=540;
   let scene=null,angle=0,dx=0;
   window.testScene=async(name,motion={})=>{const im=new Image();im.src=fixtureData[name];await im.decode();scene=im;angle=motion.angle||0;dx=motion.dx||0;draw();};
   function draw(){if(!scene)return;const q=videoCanvas.getContext('2d');q.fillStyle='#eeeeee';q.fillRect(0,0,960,540);q.save();q.translate(480+dx,270);q.rotate(angle*Math.PI/180);q.drawImage(scene,-480,-270);q.restore();}
   setInterval(draw,50);
   Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{if(!scene)await window.testScene('white');return videoCanvas.captureStream(20);}});
  },{fixtureData});
  await page.goto(process.env.TEST_URL||origin,{waitUntil:'domcontentloaded'});if(process.env.EXPECTED_BUNDLE)assert.ok((await page.locator('script[type=module]').getAttribute('src')).includes(process.env.EXPECTED_BUNDLE),'The published build must match the tested revision');await page.click('#start');
  try{await page.waitForFunction(()=>Number.isFinite(window.meikiMetrics?.firstLabelMs),null,{timeout:60000});}catch(e){console.error('STARTUP DIAGNOSTICS',JSON.stringify(await page.evaluate(()=>({status:document.getElementById('status').textContent,metrics:window.meikiMetrics,state:window.meikiCamera?.getState(),video:{ready:document.getElementById('video').readyState,width:document.getElementById('video').videoWidth}}))),errors);throw e;}
  await page.waitForFunction(()=>window.meikiMetrics.scans.length>=4,null,{timeout:120000});
  let state=await page.evaluate(()=>({metrics:meikiMetrics,labels:drawnRomaji,state:meikiCamera.getState(),coi:crossOriginIsolated}));
  await page.screenshot({path:'tests/'+engineName+'-'+device+'-live.png',fullPage:true});
  console.log(device,JSON.stringify({readyMs:state.metrics.readyMs,firstLabelMs:state.metrics.firstLabelMs,scans:state.metrics.scans}));assert.ok(state.labels.some(t=>/kudasai|shinaide/.test(t)),'actual romaji rendered');assert.equal(state.coi,false,'Pages-compatible non-isolated path');assert.ok(state.metrics.scans.some(s=>s.text.includes('分解')),'mixed kanji OCR');assert.ok(state.metrics.scans.some(s=>s.text.includes('ジャスミン')),'katakana OCR');
  assert.ok(state.labels.includes('jasumintii'),'Actual katakana OCR reaches double-vowel label');
  await page.evaluate(()=>drawnRomaji.length=0);await page.click('#long-vowels');
  await page.waitForFunction(()=>drawnRomaji.includes('jasumintī'),null,{timeout:10000});
  await page.evaluate(()=>drawnRomaji.length=0);await page.click('#long-vowels');
  await page.waitForFunction(()=>drawnRomaji.includes('jasumintii'),null,{timeout:10000});
  const firstCount=state.metrics.scans.length;
  await page.evaluate(()=>testScene('black'));await page.waitForFunction(n=>meikiMetrics.scans.length>n+1,firstCount,{timeout:120000});
  let black=await page.evaluate(()=>({metrics:meikiMetrics,state:meikiCamera.getState(),labels:drawnRomaji}));assert.ok(black.metrics.scans.slice(firstCount).some(s=>s.text.includes('あけないで')),'white on black OCR');assert.ok(black.state.objectEpoch>state.state.objectEpoch,'A new object resets history and palette even if optical flow fails');assert.ok(!black.state.tracks.some(t=>t.text.includes('しないで')),'old object label not restored');
  const epoch=black.state.objectEpoch;
  await page.evaluate(()=>testScene('white',{dx:12,angle:3}));await page.waitForFunction(n=>meikiMetrics.scans.length>n+1,black.metrics.scans.length,{timeout:120000});
  const moved=await page.evaluate(()=>meikiCamera.getState());assert.ok(moved.tracks.length>0,'Moved/rotated target still has positioned labels');
  await page.click('#scan');await page.waitForFunction(()=>meikiCamera.getState().stillMode&&meikiCamera.getState().stillItems.length>0,null,{timeout:120000});
  await page.click('#pause-scan');await page.click('#live-return');await page.waitForFunction(()=>!meikiCamera.getState().stillMode,null,{timeout:10000});
  await page.click('#stop');await page.waitForFunction(()=>!meikiCamera.getState().active);
  let warmInitialMs=null;if(process.env.TEST_URL){await page.reload({waitUntil:'domcontentloaded'});await page.click('#start');await page.waitForFunction(()=>Number.isFinite(window.meikiMetrics?.firstLabelMs),null,{timeout:60000});warmInitialMs=await page.evaluate(()=>meikiMetrics.firstLabelMs);await page.click('#stop');}
  let servedAssets=[];
  if(process.env.TEST_URL&&device==='android-layout'){
   servedAssets=await page.evaluate(async()=>{const manifest=await(await fetch('./ocr-assets/manifest.json')).json(),out=[];for(const asset of [...manifest.models,...manifest.runtime]){const data=await(await fetch('./ocr-assets/'+asset.path)).arrayBuffer();out.push({path:asset.path,bytes:data.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('')});}return out;});
   const expected=JSON.parse(await readFile(resolve(root,'ocr-assets/manifest.json'),'utf8'));for(const asset of [...expected.models,...expected.runtime]){const actual=servedAssets.find(a=>a.path===asset.path);assert.equal(actual.bytes,asset.byteLength);assert.equal(actual.sha256,asset.sha256);}
  }
  assert.equal(uploads.length,0,'No image/text POST requests');assert.equal(errors.length,0,errors.join('\n'));assert.ok(!network.some(u=>/tesseract|traineddata|jsep/.test(u)),'No Tesseract or GPU downloads');
  await page.screenshot({path:'tests/'+device+'.png',fullPage:true});
  results.push({device,engine:engineName+' '+browser.version(),realPhone:false,initialMs:state.metrics.firstLabelMs,warmInitialMs,readyMs:state.metrics.readyMs,continuousMs:state.metrics.scans.slice(1).map(s=>s.ms),whiteText:state.metrics.scans[0].text,blackText:black.metrics.scans.at(-1).text,errors,uploads:uploads.length,requests:network.length,objectEpochAfterBlack:epoch,servedAssets});
  await context.close();console.log('PASS',device);
 }
 await writeFile('tests/'+(process.env.TEST_URL?'published-':'')+engineName+'-browser-results.json',JSON.stringify(results,null,2));
}finally{await browser.close();server.close();}
