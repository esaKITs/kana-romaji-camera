import {createMeikiOcr} from '../vendor/meikiocr-web/index.js';
import {createAdapter} from './bridge.js';
let pending=null;
export const metrics={progress:[],scans:[],readyMs:null,firstLabelMs:null,startClickMs:null,backend:'wasm',error:null};
const status=message=>{const el=document.getElementById('status');if(el)el.textContent=message;const p=document.getElementById('progress');if(p){p.hidden=false;p.textContent=message;}};
export function initialize(){
 if(pending)return pending;
 const began=performance.now();status('Loading Japanese OCR models…');
 pending=(async()=>{
  const base=new URL('./ocr-assets/',location.href).href;
  const response=await fetch(base+'manifest.json');if(!response.ok)throw Error('OCR manifest HTTP '+response.status);
  const manifest=await response.json();
  const client=await createMeikiOcr({manifest,assetBaseUrl:base,profile:'meikipop-v2',execution:'wasm',wasmThreads:1,vertical:'off',recognitionBatchSize:1,maxInputPixels:4000000,scanTimeoutMs:60000,
   workerFactory:()=>new Worker(new URL('../vendor/meikiocr-web/worker.js',import.meta.url),{type:'module'}),
   onProgress:e=>{metrics.progress.push(e);if(metrics.progress.length>80)metrics.progress.shift();const mb=e.loadedBytes?` ${(e.loadedBytes/1e6).toFixed(1)} MB`:'';status(e.phase==='initializing'?'Preparing Japanese OCR…':e.phase==='ready'?'Japanese OCR ready':'Loading Japanese OCR: '+(e.phase||'')+mb);}
  });
  metrics.readyMs=performance.now()-began;
  return createAdapter(client,{onResult:(snapshot,ms)=>{metrics.scans.push({ms,text:snapshot.lines.map(l=>l.text).join('\n'),backend:snapshot.diagnostics.backend,warnings:snapshot.diagnostics.warnings});if(metrics.scans.length>40)metrics.scans.shift();}});
 })().catch(e=>{pending=null;metrics.error=e.message;status('OCR error: '+e.message);throw e});
 return pending;
}
window.MeikiOCR={createWorker:()=>initialize()};window.meikiMetrics=metrics;
window.addEventListener('pagehide',()=>{pending?.then(adapter=>adapter.terminate()).catch(()=>{});});
initialize().catch(()=>{});
