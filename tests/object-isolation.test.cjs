const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,reading,data,deferred}=require('./harness.cjs');
function setup(){const h=load();h.run('active=true;work.width=640;work.height=360;wc.fillStyle="white";wc.fillRect(0,0,640,360);video.getContext("2d").drawImage(work,0,0)');return h;}
function paintPattern(canvas,dark=false){const q=canvas.getContext('2d');q.fillStyle=dark?'#151515':'#f5f5f5';q.fillRect(0,0,640,360);q.fillStyle=dark?'#f5f5f5':'#151515';for(let y=40;y<320;y+=35)for(let x=40;x<600;x+=35)q.fillRect(x,y,12+(x%3),15);}
function transformFor(angle,tx=0,ty=0){const c=Math.cos(angle),s=Math.sin(angle);return {m:[c,-s,320-320*c+180*s+tx,s,c,180-320*s-180*c+ty,0,0,1],W:640,H:360,refW:640,refH:360};}
function transformed(h,source,angle,tx=0,ty=0){const target=h.makeCanvas(),q=target.getContext('2d');q.fillStyle='#f5f5f5';q.fillRect(0,0,640,360);q.translate(320+tx,180+ty);q.rotate(angle);q.drawImage(source,-320,-180);return target;}

test('registration rejects black→white and white→black despite a claimed identity transform',()=>{
 const h=setup(),black=h.makeCanvas(),white=h.makeCanvas();paintPattern(black,true);paintPattern(white,false);h.put('black',black);h.put('white',white);h.put('transform',transformFor(0));
 assert.equal(h.run('verifyRegistration(black,white,transform).status'),'mismatch');assert.equal(h.run('verifyRegistration(white,black,transform).status'),'mismatch');
});
test('registration preserves a moved or rotated same target from real raster pixels',()=>{
 const h=setup(),source=h.makeCanvas();paintPattern(source);h.put('source',source);
 for(const [angle,tx,ty] of [[0,12,6],[.12,0,0],[-.12,8,-5]]){
  h.put('target',transformed(h,source,angle,tx,ty));h.put('transform',transformFor(angle,tx,ty));
  assert.equal(h.run('verifyRegistration(source,target,transform).status'),'verified',JSON.stringify([angle,tx,ty]));
 }
});
test('different white-background textures are not accepted merely for similar mean brightness',()=>{
 const h=setup(),source=h.makeCanvas(),target=h.makeCanvas();paintPattern(source);paintPattern(target);const q=target.getContext('2d');q.fillStyle='#f5f5f5';q.fillRect(0,0,640,360);q.fillStyle='#151515';for(let y=60;y<340;y+=35)for(let x=58;x<620;x+=35)q.fillRect(x,y,15,12);
 h.put('source',source);h.put('target',target);h.put('transform',transformFor(0));assert.notEqual(h.run('verifyRegistration(source,target,transform).status'),'verified');
});
test('low-texture scene changes remain quarantined rather than confirmed',()=>{
 const h=setup(),a=h.makeCanvas(),b=h.makeCanvas();a.getContext('2d').fillStyle='white';a.getContext('2d').fillRect(0,0,640,360);b.getContext('2d').fillStyle='#f0f0f0';b.getContext('2d').fillRect(0,0,640,360);h.put('a',a);h.put('b',b);h.put('transform',transformFor(0));assert.equal(h.run('verifyRegistration(a,b,transform).status'),'uncertain');
});
test('a false OpenCV transform cannot transplant labels to another package',()=>{
 const h=setup();h.put('items',[reading()]);h.run('wc.fillStyle="black";wc.fillRect(0,0,640,360);rememberRecognition(work,items,"live-frame");wc.fillStyle="white";wc.fillRect(0,0,640,360);flowLocate=()=>({m:[1,0,0,0,1,0,0,0,1],W:640,H:360,refW:640,refH:360})');assert.equal(h.run('transferToStill(work).length'),0);assert.equal(h.run('sharedRecognition.items.length'),0);
});
test('tracking mismatch discards reference, evidence, labels and cached paper color',async()=>{
 const h=setup();h.put('items',[reading()]);h.run('referenceCanvas=work;referenceItems=items;protectedKana=items;tracks=items;sharedLabelColor=[0,0,0];rememberRecognition(work,items,"still-frame");flowLocate=()=>{lastRegistrationStatus="mismatch";return null}');const oldRun=h.run('runId');await h.run('trackTick()');assert.equal(h.run('referenceCanvas'),null);assert.equal(h.run('protectedKana.length'),0);assert.equal(h.run('sharedRecognition.items.length'),0);assert.equal(h.run('tracks.length'),0);assert.equal(h.run('sharedLabelColor'),null);assert.ok(h.run('runId')>oldRun);
});
test('uncertain tracking hides labels without destroying correct recoverable evidence',async()=>{
 const h=setup();h.put('items',[reading()]);h.run('referenceCanvas=work;referenceItems=items;protectedKana=items;tracks=items;flowLocate=()=>{lastRegistrationStatus="uncertain";return null}');await h.run('trackTick()');await h.run('trackTick()');assert.equal(h.run('tracks.length'),0);assert.equal(h.run('protectedKana.length'),1);assert.equal(h.run('referenceItems.length'),1);
});
test('late old-object OCR cannot overwrite a reset new scene',async()=>{
 const h=setup(),d=deferred();h.put('mock',{setParameters:async()=>{},recognize:()=>d.promise});h.run('worker=mock;kleeUnavailable=true');const p=h.run('scan()');h.run('resetObjectState()');d.resolve({data:data([reading()])});await p;assert.equal(h.run('sharedRecognition.items.length'),0);assert.equal(h.run('tracks.length'),0);
});
test('Live→Still→Live retains one object but rejects a new black object after white',()=>{
 const h=setup();h.put('items',[reading('ください',90,undefined,{state:'confirmed'})]);h.run('rememberRecognition(work,items,"live-frame");enterStill();exitStill()');assert.equal(h.run('referenceItems.length'),1);
 h.run('video.getContext("2d").fillStyle="black";video.getContext("2d").fillRect(0,0,640,360);flowLocate=()=>({m:[1,0,0,0,1,0,0,0,1],W:640,H:360,refW:640,refH:360});enterStill()');assert.equal(h.run('stillItems.length'),0);assert.equal(h.run('stillSource.getContext("2d").getImageData(1,1,1,1).data[0]'),0);
});
test('kana fragments separated by a kanji symbol never recombine within one OCR word',()=>{
 const h=setup();h.put('ocr',{blocks:[{paragraphs:[{lines:[{words:[{text:'し漢ない',confidence:90,bbox:{x0:100,y0:100,x1:155,y1:130},symbols:[{text:'し',bbox:{x0:100,y0:100,x1:120,y1:130}},{text:'漢',bbox:{x0:120,y0:100,x1:125,y1:130}},{text:'ない',bbox:{x0:125,y0:100,x1:155,y1:130}}]}]}]}]}]});
 const found=h.run('rebuildRows(extract(ocr))');assert.deepEqual(Array.from(found,x=>x.text),['し','ない']);
});
test('a detected kana chain joins contiguous fragments without creating a cross-kanji phrase',()=>{
 const h=setup();h.put('ocr',{blocks:[{paragraphs:[{lines:[{words:[{text:'しないで',confidence:90,bbox:{x0:100,y0:100,x1:220,y1:130}},{text:'ください',confidence:92,bbox:{x0:222,y0:100,x1:342,y1:130}}]}]}]}]});assert.equal(h.run('rebuildRows(extract(ocr))[0].text'),'しないでください');
});
test('a high-confidence fragment cannot promote its low-confidence neighbor to certainty',()=>{
 const h=setup();h.put('ocr',{blocks:[{paragraphs:[{lines:[{words:[{text:'しない',confidence:25,bbox:{x0:100,y0:100,x1:190,y1:130}},{text:'でください',confidence:95,bbox:{x0:192,y0:100,x1:342,y1:130}}]}]}]}]});assert.equal(h.run('extract(ocr)[0].confidence'),25);
});
test('row reconstruction preserves the weakest confidence instead of max confidence',()=>{
 const h=setup();h.put('items',[reading('しない',25,{x0:100,y0:100,x1:190,y1:130}),reading('でください',95,{x0:191,y0:100,x1:342,y1:130})]);assert.equal(h.run('rebuildRows(items)[0].confidence'),25);
});
test('display alignment never moves a small kana label outside its own glyph box',()=>{
 const h=setup();h.put('items',[reading('しないで',90,{x0:100,y0:100,x1:220,y1:140}),reading('の',90,{x0:230,y0:130,x1:250,y1:145}),reading('ください',90,{x0:260,y0:100,x1:380,y1:140})]);const aligned=h.run('lineAligned(items)');for(const it of aligned){assert.ok(it.displayBox.y0>=it.box.y0);assert.ok(it.displayBox.y1<=it.box.y1);}
});
test('long romanization wraps inside glyph bounds with a readable minimum size',()=>{
 const h=setup();const layout=h.run('romajiLayout("shinaidekudasai",100,36,1)');assert.ok(layout);assert.ok(layout.lines.length<=2);assert.equal(Array.from(layout.lines).join(''),'shinaidekudasai');assert.ok(layout.font>=10);assert.ok(layout.lines.length*layout.font*1.05<=36);
});
test('uncertain OCR is retained as evidence but not painted as confident text',()=>{
 const h=setup();h.put('items',[reading('しなぃで',25)]);h.run('stillMerge(stillItems,items,"still-1");paint(stillItems)');assert.equal(h.run('stillItems.length'),1);assert.equal(h.drawn.length,0);
});

test('black-white appearance reset remains active when OpenCV is unavailable',async()=>{
 const h=setup();h.put('items',[reading()]);h.run('wc.fillStyle="black";wc.fillRect(0,0,640,360);referenceCanvas=work;referenceItems=items;protectedKana=items;tracks=items;rememberRecognition(work,items,"still-frame")');await h.run('trackTick()');assert.equal(h.run('referenceCanvas'),null);assert.equal(h.run('sharedRecognition.items.length'),0);
});
test('realistic Japanese side bearings join one kana phrase while a full word space stays separate',()=>{
 const h=setup();const line={bbox:{x0:47,y0:48,x1:414,y1:89},words:[{text:'し',confidence:95,bbox:{x0:47,y0:51,x1:75,y1:87}},{text:'ない',confidence:95,bbox:{x0:98,y0:49,x1:180,y1:87}}]};h.put('ocr',{blocks:[{paragraphs:[{lines:[line]}]}]});assert.equal(h.run('extract(ocr)[0].text'),'しない');
 h.put('ocr',{blocks:[{paragraphs:[{lines:[{words:[{text:'ねこ',confidence:95,bbox:{x0:100,y0:100,x1:160,y1:130}},{text:'いぬ',confidence:95,bbox:{x0:220,y0:100,x1:280,y1:130}}]}]}]}]});assert.equal(h.run('extract(ocr).length'),2);
});
for(const row of require('./fixtures/klee-ocr.json'))test('real OCR geometry regression: '+row.image,()=>{
 const h=setup();h.put('ocr',row.data);const items=h.run('rebuildRows(extract(ocr,{width:720,height:130}))');assert.equal(items.length,1);assert.equal(items[0].text,row.expected);
});

test('an earlier object epoch cannot transfer even an identical cached image',()=>{
 const h=setup();h.put('items',[reading()]);h.run('rememberRecognition(work,items,"still-frame");objectEpoch++');assert.equal(h.run('transferToStill(work).length'),0);
});
test('Live return cannot seed a previous object epoch into reference tracking',()=>{
 const h=setup();h.put('items',[reading()]);h.run('rememberRecognition(work,items,"still-frame");objectEpoch++;stillMode=true;stillSource=work;stillItems=[];exitStill()');assert.equal(h.run('referenceItems.length'),0);
});
