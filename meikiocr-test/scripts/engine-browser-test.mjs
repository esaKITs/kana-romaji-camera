// Real WebKit/Chromium inference on source images. This deliberately does not
// claim camera verification when a headless GStreamer camera cannot present.
import {createServer} from 'node:http';import {readFile,writeFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {webkit,chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');const name=process.env.BROWSER||'webkit';
const {load}=createRequire(import.meta.url)('../tests/controller/harness.cjs');
const root=resolve('dist'),fixtures=resolve('tests/fixtures');const server=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://x').pathname,file=p.startsWith('/test-fixtures/')?resolve(fixtures,p.slice(15)):resolve(root,'.'+(p==='/'?'/index.html':p));if(!file.startsWith(root+'/')&&!file.startsWith(fixtures+'/'))throw Error('path');res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.png':'image/png','.json':'application/json'})[extname(file)]||'application/octet-stream'}).end(await readFile(file));}catch(e){res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await (name==='webkit'?webkit:chromium).launch(name==='webkit'?{executablePath:process.env.WEBKIT_PATH,headless:true}:{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
const results=[],errors=[],uploads=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')uploads.push(r.url())});
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
 for(const fixture of ['white','black','white']){
  const r=await page.evaluate(async fixture=>{const image=new Image();image.src='/test-fixtures/'+fixture+'.png';await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);const provider=await MeikiOCR.createWorker();const t=performance.now();const result=await provider.recognize(c);return {data:result.data,elapsedMs:performance.now()-t,readyMs:meikiMetrics.readyMs};},fixture);
  assert.ok(r.data.text.includes(fixture==='black'?'あけないで':'しないでください'),r.data.text);assert.ok(r.data.text.includes(fixture==='black'?'コーヒー':'ジャスミンティー'),r.data.text);
  const h=load();h.put('data',r.data);const items=h.run('work.width=960;work.height=540;rebuildRows(extract(data))');assert.ok(items.length>0);assert.ok(items.every(it=>it.box.x0>=0&&it.box.x1<=960&&it.box.y0>=0&&it.box.y1<=540));h.put('items',items);h.run('paint(items)');assert.ok(h.drawn.length>0);assert.ok(items.some(it=>it.text.includes(fixture==='black'?'あけないで':'しないでください')),'contiguous kana preserved');
  results.push({browser:name,version:browser.version(),realPhone:false,cameraTested:false,fixture,elapsedMs:r.elapsedMs,readyMs:r.readyMs,text:r.data.text,regions:items.map(it=>({text:it.text,box:it.box})),romaji:h.drawn});console.log('PASS',name,fixture,Math.round(r.elapsedMs)+'ms');
 }
 assert.deepEqual(errors,[]);assert.deepEqual(uploads,[]);await writeFile('tests/'+name+'-engine-results.json',JSON.stringify({results,errors,uploads},null,2));
}finally{await browser.close();server.close();}
