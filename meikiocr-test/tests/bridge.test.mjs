import {test} from 'node:test';import assert from 'node:assert/strict';import {snapshotToData,createAdapter} from '../src/bridge.js';
const glyph=(text,x,confidence=.95)=>({text,box:[x,10,x+20,40],confidence});
const snapshot=(text='しないでください',id='test')=>({frameId:id,lines:[{text,box:[0,10,text.length*20,40],orientation:'horizontal',glyphs:[...text].map((t,i)=>glyph(t,i*20))}],diagnostics:{backend:'wasm'}});
test('mixed Japanese retains kana boundaries and actual per-character positions',()=>{const d=snapshotToData(snapshot('分解したりしないでください。'));const w=d.blocks[0].paragraphs[0].lines[0].words;assert.deepEqual(w.map(x=>x.text),['分解','したりしないでください','。']);assert.equal(w[1].bbox.x0,40);assert.equal(w[1].symbols.length,11);assert.equal(w[1].symbols[1].bbox.x0,60);});
test('kana, katakana and punctuation preserve original reading order without dictionaries inventing text',()=>{const s=snapshot('ジャスミン茶です。');const d=snapshotToData(s);assert.equal(d.text,s.lines[0].text);assert.deepEqual(d.blocks[0].paragraphs[0].lines[0].words.map(w=>w.text),['ジャスミン','茶','です','。']);});
test('non-finite glyph geometry is excluded without fabricating a position',()=>{const s=snapshot('あいう');s.lines[0].glyphs[1].box=[NaN,0,1,2];const w=snapshotToData(s).blocks[0].paragraphs[0].lines[0].words;assert.deepEqual(w.map(x=>x.text),['あ','う']);});
test('only horizontal lines are used, and empty results are valid',()=>{const s=snapshot();s.lines[0].orientation='vertical';assert.equal(snapshotToData(s).text,'');assert.equal(snapshotToData({lines:[]}).text,'');});
const image={width:2,height:2,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(16)})})};
test('one scan at a time and a frame ID check prevent old replies being relabelled',async()=>{let finish;const client={scan:frame=>new Promise(resolve=>finish=()=>resolve(snapshot('あ',frame.frameId))),dispose:async()=>{}};const a=createAdapter(client);const first=a.recognize(image);await assert.rejects(a.recognize(image),/busy/);finish();assert.equal((await first).data.text,'あ');});
test('out-of-order provider reply is rejected instead of replacing the current frame',async()=>{const a=createAdapter({scan:async()=>snapshot('あ','old-frame'),dispose:async()=>{}});await assert.rejects(a.recognize(image),/frame mismatch/);});
test('dispose rejects a delayed inference result',async()=>{let finish;const a=createAdapter({scan:f=>new Promise(r=>finish=()=>r(snapshot('あ',f.frameId))),dispose:async()=>{}});const p=a.recognize(image);await a.terminate();finish();await assert.rejects(p,/disposed/);await assert.rejects(a.recognize(image),/disposed/);});
test('inference errors are visible and release the busy lock for a retry',async()=>{let n=0;const a=createAdapter({scan:async f=>{if(!n++)throw Error('failure');return snapshot('あ',f.frameId)},dispose:async()=>{}});await assert.rejects(a.recognize(image),/failure/);assert.equal((await a.recognize(image)).data.text,'あ');});

test('real controller extracts one contiguous kana phrase from mixed Meiki glyphs',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url),{load}=require('./controller/harness.cjs');const h=load();h.put('data',snapshotToData(snapshot('分解したりしないでください。')));
 const regions=h.run('work.width=640;work.height=360;rebuildRows(extract(data))');assert.equal(regions.length,1);assert.equal(regions[0].text,'したりしないでください');assert.equal(regions[0].box.x0,40);assert.equal(h.run('contextualRomaji("したりしないでください")'),'shitarishinaidekudasai');
});
test('a single clear kana can reach the original renderer without waiting for a sentence',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url),{load}=require('./controller/harness.cjs');const h=load();h.put('data',snapshotToData(snapshot('あ')));h.run('work.width=640;work.height=360;paint(extract(data))');assert.ok(h.drawn.includes('a'));
});
test('appearance change invalidates old state before optical-flow early returns',async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url),{load}=require('./controller/harness.cjs');const h=load();h.run('work.width=640;work.height=360;wc.fillStyle="white";wc.fillRect(0,0,640,360);referenceCanvas=work;referenceItems=[{text:"あ",box:{x0:10,y0:10,x1:30,y1:40}}];video.getContext("2d").fillStyle="black";video.getContext("2d").fillRect(0,0,640,360);flowPrepare=()=>true');assert.equal(h.run('flowLocate()'),null);assert.equal(h.run('lastRegistrationStatus'),'mismatch');
});
test('large Still variants stay within the provider pixel limit and map glyph coordinates back exactly',async()=>{
 let sent,drawn=false;const large={width:2560,height:1920,getContext:()=>{throw Error('Never read the oversized input bitmap directly')}};
 const factory=()=>{const c={width:0,height:0,getContext:()=>({drawImage:source=>{assert.equal(source,large);drawn=true},getImageData:()=>({data:new Uint8ClampedArray(c.width*c.height*4)})})};return c};
 const a=createAdapter({scan:async f=>{sent=f;assert.ok(f.width*f.height<=4000000);return {...snapshot('あ',f.frameId),width:f.width,height:f.height}},dispose:async()=>{}},{canvasFactory:factory});
 const result=await a.recognize(large),word=result.data.blocks[0].paragraphs[0].lines[0].words[0];assert.ok(drawn);assert.equal(word.bbox.x1,20*large.width/sent.width);assert.equal(word.bbox.y0,10*large.height/sent.height);assert.equal(word.bbox.y1,40*large.height/sent.height);assert.equal(sent.rgba.byteLength,sent.width*sent.height*4);
});
