const {test}=require('node:test');const assert=require('node:assert/strict');
const {load,reading}=require('./harness.cjs');
function pattern(h,seed=1){const c=h.makeCanvas(),q=c.getContext('2d');q.fillStyle='#b4b4b4';q.fillRect(0,0,640,360);q.fillStyle='#232323';let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};for(let i=0;i<210;i++)q.fillRect(20+random()*600,20+random()*320,5+random()*15,5+random()*13);return c;}
function exposed(h,source,gain,offset,dx=0,dy=0){const c=h.makeCanvas(),q=c.getContext('2d');q.fillStyle='#b4b4b4';q.fillRect(0,0,640,360);q.drawImage(source,dx,dy);const image=q.getImageData(0,0,640,360);for(let i=0;i<image.data.length;i+=4)for(let j=0;j<3;j++)image.data[i+j]=Math.max(0,Math.min(255,image.data[i+j]*gain+offset));q.putImageData(image,0,0);return c;}
function setup(){const h=load();h.run('active=true;work.width=640;work.height=360');return h;}
for(const direction of ['on','off'])test('torch '+direction+' exposure jump preserves independently verified same-target labels',async()=>{
 const h=setup(),base=pattern(h),dim=exposed(h,base,.5,0),bright=exposed(h,base,1,45);
 h.put('source',direction==='on'?dim:bright);h.put('target',direction==='on'?bright:dim);h.put('items',[reading()]);
 h.run('referenceCanvas=source;referenceItems=items;tracks=items;wc.drawImage(source,0,0);video.getContext("2d").drawImage(target,0,0);flowLocate=()=>{lastRegistrationStatus="mismatch";return null}');
 for(let i=0;i<6;i++){await h.run('trackTick()');h.advance(65);assert.equal(h.run('tracks.length'),1);assert.equal(h.run('objectEpoch'),0)}
 assert.ok(h.drawn.includes('kudasai'));
});
test('exposure change with target movement updates coordinates rather than freezing labels',async()=>{
 const h=setup(),base=pattern(h);h.put('source',exposed(h,base,.5,0));h.put('target',exposed(h,base,1,45,16,8));h.put('items',[reading()]);
 h.run('referenceCanvas=source;referenceItems=items;tracks=items;video.getContext("2d").drawImage(target,0,0);flowLocate=()=>{lastRegistrationStatus="uncertain";return null}');
 await h.run('trackTick()');await h.run('trackTick()');assert.equal(h.run('tracks.length'),1);assert.ok(Math.abs(h.run('tracks[0].box.x0')-116)<5);assert.ok(Math.abs(h.run('tracks[0].box.y0')-108)<5);
});
test('exposure-adjusted registration still rejects a different textured target',()=>{
 const h=setup();h.put('source',exposed(h,pattern(h,1),.5,0));h.put('target',exposed(h,pattern(h,298),1,45));
 assert.notEqual(h.run('verifyRegistration(source,target,{m:[1,0,0,0,1,0,0,0,1],W:640,H:360}).status'),'verified');
});
test('polarity inversion is an object change, not a recoverable lighting gain',()=>{
 const h=setup();h.put('source',pattern(h));h.put('target',exposed(h,pattern(h),-1,255));
 assert.equal(h.run('verifyRegistration(source,target,{m:[1,0,0,0,1,0,0,0,1],W:640,H:360}).status'),'mismatch');
});
test('complete glare without verifiable texture cannot keep old labels',async()=>{
 const h=setup();h.put('source',pattern(h));h.put('items',[reading()]);
 h.run('referenceCanvas=source;referenceItems=items;tracks=items;video.getContext("2d").fillStyle="white";video.getContext("2d").fillRect(0,0,640,360);flowLocate=()=>{lastRegistrationStatus="uncertain";return null}');
 await h.run('trackTick()');await h.run('trackTick()');assert.equal(h.run('tracks.length'),0);
});
test('real printed-text fixture remains verifiable when dimmed samples have low global variance',async()=>{
 const {loadImage}=require('@napi-rs/canvas'),path=require('node:path');
 const h=setup(),image=await loadImage(path.join(__dirname,'../fixtures/white.png'));
 const source=h.makeCanvas();source.getContext('2d').drawImage(image,0,0,640,360);
 h.put('source',source);h.put('target',exposed(h,source,.5,0));
 const result=h.run('verifyRegistration(source,target,{m:[1,0,0,0,1,0,0,0,1],W:640,H:360})');
 assert.equal(result.status,'verified');assert.equal(result.reason,'exposure-adjusted');
});
