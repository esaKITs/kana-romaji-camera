// Built-application UI and storage checks in actual Chromium/WebKit engines.
// No physical camera or physical mobile device is claimed by this test.
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve('dist'),name=process.env.BROWSER||'chromium';
const server=createServer(async(req,res)=>{try{
 const p=new URL(req.url,'http://x').pathname,file=resolve(root,'.'+(p==='/'?'/index.html':p));
 if(!file.startsWith(root+'/'))throw Error('path');
 res.writeHead(200,{'content-type':({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.wasm':'application/wasm','.png':'image/png'})[extname(file)]||'application/octet-stream'}).end(await readFile(file));
}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await(name==='webkit'?webkit:chromium).launch(name==='webkit'?{executablePath:process.env.WEBKIT_PATH,headless:true}:{executablePath:process.env.CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'],headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:640},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[],uploads=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()!=='GET')uploads.push(r.url())});
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.meikiCamera);
 const cases=[['パーティー','paatii','pātī'],['せんせい','sensee','sensē'],['おもう','omou','omou'],['テイクアウト','teikuauto','teikuauto'],['しんぶん','shimbun','shimbun'],['れんあい','ren’ai','ren’ai'],['ほんや','hon’ya','hon’ya'],['でんわ','denwa','denwa']];
 const verify=async mode=>{for(const [text,double,macron] of cases)assert.equal(await page.evaluate(t=>meikiCamera.romaji(t),text),mode==='double'?double:macron)};
 await verify('double');const toggle=page.locator('#long-vowels');await toggle.click();await verify('macron');assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.meikiCamera);await verify('macron');assert.equal(await toggle.textContent(),'ā');
 await toggle.focus();await page.keyboard.press('Space');await verify('double');assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 assert.deepEqual(errors,[]);assert.deepEqual(uploads,[]);
 const result={browser:name,version:browser.version(),realPhone:false,cameraTested:false,conversions:cases.length*4,toggle:true,reloadPersistence:true,keyboard:true,errors,uploads};
 await writeFile('tests/'+name+'-romanization-browser-results.json',JSON.stringify(result,null,2));console.log('PASS romanization',JSON.stringify(result));await context.close();
}finally{await browser.close();server.close()}
