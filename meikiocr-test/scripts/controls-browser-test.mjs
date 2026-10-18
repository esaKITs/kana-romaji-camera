// Actual browser layout/camera lifecycle test with a portrait synthetic stream.
// OCR is stubbed here; the separate integration tests run the real OCR engine.
import {createServer} from 'node:http';import {readFile,writeFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve('dist'),html=await readFile('.testing/camera.html');
const server=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://x').pathname;const file=resolve(root,'.'+p);if(p!=='/'&&!file.startsWith(root+'/'))throw Error('path');res.writeHead(200,{'content-type':p==='/'?'text/html':({'.js':'text/javascript','.mjs':'text/javascript','.png':'image/png'})[extname(p)]||'application/octet-stream'}).end(p==='/'?html:await readFile(file))}catch{res.writeHead(404).end()}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true}),results=[];
try{
 for(const [name,width,height] of [['iphone',390,640],['android',412,700],['short-landscape',844,390]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(({torchSupported})=>{
   window.MeikiOCR={createWorker:async()=>({meiki:true,setParameters:async()=>{},recognize:()=>new Promise(()=>{})})};
   const c=document.createElement('canvas');c.width=640;c.height=1136;const q=c.getContext('2d');q.fillStyle='#ddd';q.fillRect(0,0,c.width,c.height);let n=0;setInterval(()=>{q.fillStyle=n++%2?'#111':'#222';q.fillRect(0,0,20,20)},50);
   Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{const s=c.captureStream(20);window.testCameraTrack=s.getVideoTracks()[0];window.mockTorchCalls=[];if(torchSupported){let on=false;Object.defineProperties(window.testCameraTrack,{getCapabilities:{value:()=>({torch:true})},getSettings:{value:()=>({torch:on})},getConstraints:{value:()=>({width:{ideal:640}})},applyConstraints:{value:async constraints=>{mockTorchCalls.push(constraints.torch);on=constraints.torch}}});}return s}});
  },{torchSupported:name==='android'});
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await page.click('#start');await page.waitForFunction(()=>meikiCamera.getState().active);
  const visible=async()=>{const b=await page.locator('#stop').boundingBox();assert.ok(b&&b.y>=0&&b.y+b.height<=page.viewportSize().height,'Stop must stay inside visible viewport');assert.equal(await page.locator('.actions').evaluate(el=>getComputedStyle(el).position),'fixed');};
  await visible();let b=await page.locator('#debug').boundingBox();assert.ok(Math.abs(b.x+b.width/2-width/2)<2,'Guides must be centered');
  const toggle=page.locator('#long-vowels'),toggleBox=await toggle.boundingBox(),guideBox=await page.locator('#debug').boundingBox();
  assert.ok(toggleBox&&toggleBox.y+toggleBox.height<=height&&toggleBox.x>guideBox.x+guideBox.width,'Long vowels must remain reachable to the right of centered guides');
  assert.equal(toggleBox.width,guideBox.width,'Long-vowel button width matches Guides');assert.equal(toggleBox.height,guideBox.height,'Long-vowel button height matches Guides');assert.equal(toggleBox.width,toggleBox.height,'Long-vowel button is square');
  assert.equal(await toggle.evaluate(el=>getComputedStyle(el).borderRadius),await page.locator('#debug').evaluate(el=>getComputedStyle(el).borderRadius));
  assert.equal(await page.locator('#torch .torch-bolt').evaluate(el=>getComputedStyle(el).fill),'rgb(0, 0, 0)','Torch bolt must have a solid black fill');
  assert.equal(await page.locator('#torch .torch-off').getAttribute('d'),'M3 3L21 21','Torch-off slash goes from top-left to bottom-right');
  assert.equal(await toggle.textContent(),'aa');assert.equal(await page.evaluate(()=>meikiCamera.romaji('パーティー')),'paatii');
  const oldGeneration=await page.evaluate(()=>meikiCamera.getState().runId);
  await toggle.click();assert.equal(await toggle.textContent(),'ā');assert.equal(await page.evaluate(()=>meikiCamera.romaji('パーティー')),'pātī');
  assert.equal(await page.evaluate(()=>meikiCamera.getState().runId),oldGeneration,'Display toggle must not restart OCR');
  assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  const light=await page.locator('#torch').boundingBox(),scan=await page.locator('#scan').boundingBox();assert.ok(Math.abs(light.y-scan.y)<2&&light.x+light.width<scan.x,'Light must be at the camera top beside Scan');assert.equal(await page.locator('.stage #torch').count(),1);assert.equal(await page.locator('.actions #torch').count(),0);
  if(name==='android'){await page.click('#torch');await page.waitForFunction(()=>document.getElementById('torch').getAttribute('aria-pressed')==='true');await page.click('#torch');await page.waitForFunction(()=>document.getElementById('torch').getAttribute('aria-pressed')==='false');assert.deepEqual(await page.evaluate(()=>mockTorchCalls),[true,false]);}else assert.ok(await page.locator('#torch').isDisabled());
  await page.screenshot({path:'tests/controls-'+name+'.png'});
  assert.equal(await page.locator('#stage').evaluate(el=>getComputedStyle(el).touchAction),'pan-y');assert.equal(await page.locator('#video').evaluate(el=>getComputedStyle(el).touchAction),'pan-y');
  assert.equal(await page.locator('#debug').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#debug .guides-off').evaluate(el=>getComputedStyle(el).display),'inline');
  await page.click('#debug');assert.equal(await page.locator('#debug').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#debug .guides-off').evaluate(el=>getComputedStyle(el).display),'none');
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));await visible();assert.ok(await page.evaluate(()=>window.scrollY)>0,'Page can scroll past portrait camera');
  await page.evaluate(()=>window.scrollTo(0,0));await page.click('#scan');await page.waitForFunction(()=>meikiCamera.getState().stillMode);await visible();assert.equal(await page.locator('#stage').evaluate(el=>getComputedStyle(el).touchAction),'none');
  await toggle.click();assert.equal(await page.evaluate(()=>meikiCamera.romaji('パーティー')),'paatii');assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  await page.click('#live-return');await page.waitForFunction(()=>!meikiCamera.getState().stillMode);assert.equal(await page.locator('#stage').evaluate(el=>getComputedStyle(el).touchAction),'pan-y');
  await page.setViewportSize({width,height:Math.max(320,height-100)});await visible();await page.click('#stop');await page.waitForFunction(()=>!meikiCamera.getState().active);assert.equal(await page.evaluate(()=>testCameraTrack.readyState),'ended');assert.ok(await page.locator('#start').isVisible());
  await toggle.click();await page.reload({waitUntil:'domcontentloaded'});assert.equal(await toggle.textContent(),'ā');assert.equal(await page.evaluate(()=>meikiCamera.romaji('パーティー')),'pātī');
  assert.deepEqual(errors,[]);results.push({name,width,height,realPhone:false,portraitCamera:true,stopReachable:true,guidesCentered:true,liveScrollAllowed:true,stillGesturesPreserved:true,torchAtCameraTop:true,torchHardwareTested:false,torchMockTested:name==='android',errors});console.log('PASS controls',name);await context.close();
 }
 await writeFile('tests/controls-browser-results.json',JSON.stringify(results,null,2));
}finally{await browser.close();server.close()}
