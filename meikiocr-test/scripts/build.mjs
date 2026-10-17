import {readFile,writeFile,mkdir,copyFile,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import {build} from 'vite';
// Static vendor/runtime assets are pinned and independently verified.
const assets=JSON.parse(await readFile('assets.lock.json','utf8'));
for(const asset of assets){
 let bytes;try{bytes=await readFile(asset.path)}catch(e){if(e.code!=='ENOENT')throw e;}
 if(!bytes||createHash('sha256').update(bytes).digest('hex')!==asset.sha256){
  const response=await fetch(asset.url);if(!response.ok)throw Error('Asset HTTP '+response.status+' '+asset.path);
  bytes=Buffer.from(await response.arrayBuffer());
 }
 if(bytes.length!==asset.byteLength||createHash('sha256').update(bytes).digest('hex')!==asset.sha256)throw Error('Asset integrity '+asset.path);
 await mkdir(asset.path.slice(0,asset.path.lastIndexOf('/')),{recursive:true});await writeFile(asset.path,bytes);
}
const source=await readFile('app.html','utf8');
const match=source.match(/<script>([\s\S]*)<\/script>/);if(!match)throw Error('Camera controller missing');
let code=match[1].replaceAll('window.Tesseract','window.MeikiOCR').replaceAll('Tesseract.createWorker','window.MeikiOCR.createWorker');
// The current baseline contains a missing statement separator. Fix the derived
// experiment only; never edit the repository root's published application.
code=code.replace('await ensureLiveWorker()if','await ensureLiveWorker();if');
code=code.replace('if(!requestedFocus){','if(!requestedFocus&&!worker.meiki){');
// Optical flow can fail before producing a matrix on a new object. Check a
// large appearance change BEFORE those early returns, so history/palette reset.
code=code.replace("lastRegistrationStatus='unavailable';\n\n if(!flowPrepare())",`lastRegistrationStatus='unavailable';
 if(referenceCanvas){
  const appearance=verifyRegistration(referenceCanvas,target,{m:[1,0,0,0,1,0,0,0,1],W:referenceCanvas.width,H:referenceCanvas.height});
  if(appearance.status==='mismatch'&&appearance.reason==='appearance-change'){lastRegistrationStatus='mismatch';return null;}
 }
 if(!flowPrepare())`);
code=code.replace('const ocrWarmup=ensureLiveWorker();','window.meikiMetrics&&(window.meikiMetrics.startClickMs=performance.now());const ocrWarmup=ensureLiveWorker();ocrWarmup.catch(()=>{});');
code=code.replace('function paint(items){','function paint(items){');
code=code.replace('accepted.push({...c,x,y,rect});','accepted.push({...c,x,y,rect});if(window.meikiMetrics&&window.meikiMetrics.firstLabelMs===null&&window.meikiMetrics.startClickMs!==null)window.meikiMetrics.firstLabelMs=performance.now()-window.meikiMetrics.startClickMs;');
// Preserve native per-glyph confidence/coordinates and use the same extraction,
// romaji, palette, tracking, Focused scan and Live/Still state machine.
code+='\nwindow.meikiCamera={getState:()=>({active,stillMode,busy,stillBusy,runId,objectEpoch,tracks:tracks.map(cloneRecognitionItem),stillItems:stillItems.map(cloneRecognitionItem)}),romaji:contextualRomaji};\n';
new vm.Script(code);await writeFile('src/camera.generated.js',code);
let html=source.replace(match[0],'<script type="module" src="/src/main.js"></script>');
html=html.replace('<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>','');
html=html.replace('https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.11.0-release.1/dist/opencv.js','./vendor/opencv.js').replace('https://cdn.jsdelivr.net/gh/davidchatting/shimage@ef0e15ee536afd1d98e0f540e3ba30fef3a1c80d/shimage.js','./vendor/shimage.js').replace('https://cdn.jsdelivr.net/gh/davidchatting/opencv-featurematch-js@ec4ed436a96ada5f33599f4953fe9c7c43d32d9b/opencv-featurematch-js.min.js','./vendor/opencv-featurematch-js.min.js');
html=html.replace('<title>Kana → Romaji Camera | esaKITs</title>','<title>Kana → Romaji Camera — MeikiOCR experiment | esaKITs</title>');
html=html.replace('Japanese OCR uses Tesseract language data', 'The original application uses Tesseract language data');
html=html.replace('Text recognition uses Tesseract OCR,','This independent experiment uses MeikiOCR Web and ONNX Runtime Web,');
html=html.replace('Tesseract.js 5 (Apache 2.0);','MeikiOCR Web (GPL-3.0-only), MeikiOCR models (LGPL-3.0), ONNX Runtime Web 1.30.0 (MIT);');
html=html.replace('href="./LICENSE">MIT License','href="./licenses/NOTICE.html">Licenses &amp; source');
html=html.replace('</footer>','<br>Independent MeikiOCR experiment · <a href="./licenses/NOTICE.html">Licenses &amp; corresponding source</a></footer>');
await writeFile('index.html',html);
await mkdir('.testing',{recursive:true});await writeFile('.testing/camera.html',html.replace('<script type="module" src="/src/main.js"></script>','<script>'+code+'</script>'));
await build();
const lock=JSON.parse(await readFile('models.lock.json','utf8'));const dir=process.env.MODEL_DIR||'models';
const out='dist/ocr-assets';await mkdir(out,{recursive:true});const models=[];
for(const model of lock.models.filter(m=>m.role!=='recognizer-vertical')){
 let bytes;try{bytes=await readFile(dir+'/'+model.file)}catch(e){if(e.code!=='ENOENT')throw e;const response=await fetch(model.url);if(!response.ok)throw Error('Model HTTP '+response.status);bytes=Buffer.from(await response.arrayBuffer());await mkdir(dir,{recursive:true});await writeFile(dir+'/'+model.file,bytes);}
 if(bytes.length!==model.byteLength||createHash('sha256').update(bytes).digest('hex')!==model.sha256)throw Error('Model integrity '+model.file);
 await writeFile(out+'/'+model.file,bytes);models.push({role:model.role,path:model.file,sha256:model.sha256,byteLength:model.byteLength});
}
const runtime=[];
for(const name of ['ort-wasm-simd-threaded.wasm','ort-wasm-simd-threaded.mjs']){
 const bytes=await readFile('node_modules/onnxruntime-web/dist/'+name);await writeFile(out+'/'+name,bytes);
 runtime.push({path:name,sha256:createHash('sha256').update(bytes).digest('hex'),byteLength:bytes.length});
}
await writeFile(out+'/manifest.json',JSON.stringify({modelSetId:lock.modelSetId,onnxruntimeWeb:'1.30.0',models,runtime},null,2));
console.log('Verified assets:',JSON.stringify([...models,...runtime].map(m=>({path:m.path,bytes:m.byteLength}))));

// GPL corresponding source is served beside the built app, not a private link.
await mkdir('dist/source',{recursive:true});
const archived=spawnSync('tar',['--exclude=node_modules','--exclude=models','--exclude=dist','--exclude=.testing','--exclude=public/vendor','--exclude=public/source','--exclude=.git','-czf','dist/source/app-source.tar.gz','.'],{stdio:'inherit'});
if(archived.status!==0)throw Error('Corresponding source archive failed');

// Cloudflare static assets have a 25 MiB per-file limit. Catch this before upload.
for(const entry of await (await import('node:fs/promises')).readdir('dist',{recursive:true,withFileTypes:true})){
 if(!entry.isFile())continue;const file=entry.parentPath+'/'+entry.name,size=(await stat(file)).size;
 if(size>25*1024*1024)throw Error('Static host per-file limit exceeded: '+file+' '+size);
}
const sourceEntries=spawnSync('tar',['-tzf','dist/source/app-source.tar.gz'],{encoding:'utf8'});
if(sourceEntries.status!==0||sourceEntries.stdout.split('\n').some(p=>p.endsWith('.onnx')))throw Error('Source archive must exclude separately distributed binary models');
console.log('Static host limits and corresponding source archive verified.');
