const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,reading,data,deferred}=require('./harness.cjs');
const json=x=>JSON.parse(JSON.stringify(x));
function setup(){const h=load();h.run('active=true;work.width=640;work.height=360;wc.fillStyle="white";wc.fillRect(0,0,640,360);video.getContext("2d").drawImage(work,0,0)');return h;}
function installWorker(h,recognize){h.put('mockWorker',{setParameters:async()=>{},recognize});h.run('worker=mockWorker;kleeUnavailable=true');}

test('enlarged OCR near bottom/right uses its actual input bounds',()=>{
 const h=setup();h.put('ocr',data([reading('ください',90,{x0:850,y0:550,x1:1200,y1:600})]));
 assert.equal(h.run('extract(ocr,{width:1280,height:720}).length'),1);
});
test('crop-local invalid coordinates are rejected',()=>{
 const h=setup();h.put('ocr',data([reading('ください',90,{x0:80,y0:20,x1:280,y1:50})]));
 assert.equal(h.run('extract(ocr,{width:200,height:100}).length'),0);
});
test('spaced kana romaji actually reaches canvas',()=>{
 const h=setup();h.put('items',[reading('ねこ いぬ')]);h.run('paint(items)');
 assert.ok(h.drawn.includes('neko inu'));
});
test('plain, contracted, geminate, particle and long vowel behavior is preserved',()=>{
 const h=setup();for(const [input,expected] of [['ぶ','bu'],['きゃ','kya'],['まっちゃ','matcha'],['は','wa'],['コーヒー','kōhī']]) assert.equal(h.run(`contextualRomaji(${JSON.stringify(input)})`),expected);
});
test('confirmed full phrase retains its projected full box against fragments',()=>{
 const h=setup();h.put('old',[reading('ください',90,undefined,{state:'confirmed',votes:3})]);h.put('fresh',[reading('ださい',70,{x0:160,y0:100,x1:300,y1:130})]);
 const out=json(h.run('protectRecognized(fresh,old,"live-1")'));
 assert.equal(out.length,1);assert.equal(out[0].text,'ください');assert.equal(out[0].box.x0,100);
});
test('verified empty OCR retains existing regions',()=>{
 const h=setup();h.put('old',[reading('ください',90,undefined,{state:'confirmed'})]);
 assert.equal(h.run('protectRecognized([],old,"live-1")[0].text'),'ください');
});
test('confirmed wrong text remains correctable by independent captures',()=>{
 const h=setup();h.put('old',reading('くだざい',85,undefined,{state:'confirmed',support:{'くだざい':{groups:['live-1','live-2'],confidence:85}}}));h.put('candidate',reading());
 h.run('merged=evidenceMerge(old,candidate,"live-3");merged=evidenceMerge(merged,candidate,"live-4");merged=evidenceMerge(merged,candidate,"live-5")');
 assert.equal(h.run('merged.text'),'ください');
});
test('old six-vote winner ages out instead of becoming permanently immutable',()=>{
 const h=setup();h.put('old',reading('くだざい',85,undefined,{state:'confirmed',support:{'くだざい':{groups:['a','b','c','d','e','f'],confidence:85}}}));h.put('candidate',reading());
 h.run('merged=old;for(let i=0;i<8;i++)merged=evidenceMerge(merged,candidate,"new-"+i)');
 assert.equal(h.run('merged.text'),'ください');assert.ok(h.run('merged.votes<=6'));
});
test('one frozen image never gains independent votes from repeated variants',()=>{
 const h=setup();h.put('old',reading());h.put('candidate',reading('くだざい',90));
 h.run('merged=old;for(let i=0;i<18;i++)merged=evidenceMerge(merged,candidate,"still-1")');
 assert.equal(h.run('merged.text'),'ください');assert.equal(h.run('merged.support["くだざい"].groups.length'),1);
});
test('higher confidence tentative reading may improve on the same frozen image',()=>{
 const h=setup();h.put('old',reading('くだざい',40,undefined,{state:'provisional',source:'still-1'}));h.put('candidate',reading('ください',90));
 assert.equal(h.run('evidenceMerge(old,candidate,"still-1").text'),'ください');
});
test('evidence merge does not mutate its previous snapshot',()=>{
 const h=setup();const old=reading('ください',90,undefined,{support:{'ください':{groups:['one'],confidence:90}}});h.put('old',old);h.put('candidate',reading('くだざい',80));
 h.run('evidenceMerge(old,candidate,"two")');assert.deepEqual(old.support,{'ください':{groups:['one'],confidence:90}});
});
test('shared snapshot deeply copies support, boxes, and image pixels',()=>{
 const h=setup();h.put('items',[reading('ください',90,undefined,{support:{'ください':{groups:['one'],confidence:90}}})]);
 h.run('rememberRecognition(work,items,"live-frame");items[0].box.x0=2;items[0].support["ください"].groups.push("two");wc.fillStyle="black";wc.fillRect(0,0,640,360)');
 assert.equal(h.run('sharedRecognition.items[0].box.x0'),100);assert.equal(h.run('sharedRecognition.items[0].support["ください"].groups.length'),1);assert.equal(h.run('sharedRecognition.canvas.getContext("2d").getImageData(0,0,1,1).data[0]'),255);
});
test('identical capture transfers immediately without external registration',()=>{
 const h=setup();h.put('items',[reading()]);h.run('rememberRecognition(work,items,"live-frame")');assert.equal(h.run('transferToStill(work).length'),1);
});
test('similar-looking page without registration does not receive old coordinates',()=>{
 const h=setup();h.put('items',[reading()]);h.run('rememberRecognition(work,items,"live-frame");wc.fillStyle="#f8f8f8";wc.fillRect(0,0,640,360)');assert.equal(h.run('transferToStill(work).length'),0);
});
test('expired shared capture is not transferred',()=>{
 const h=setup();h.put('items',[reading()]);h.run('rememberRecognition(work,items,"live-frame")');h.advance(12001);assert.equal(h.run('transferToStill(work).length'),0);
});
test('homography maps to explicit target dimensions, independent of work canvas',()=>{
 const h=setup();h.put('box',{x0:10,y0:20,x1:30,y1:40});
 const out=json(h.run('flowWarpBox(box,{m:[1,0,.1,0,1,.2,0,0,1],W:1,H:1,refW:100,refH:100},{width:200,height:300})'));
 for(const [key,value] of Object.entries({x0:40,y0:120,x1:80,y1:180}))assert.ok(Math.abs(out[key]-value)<1e-9);
});
test('direct registration uses frozen target and restores original tracking cache',()=>{
 const h=setup();h.put('items',[reading()]);h.run('rememberRecognition(work,items,"live-frame");wc.fillStyle="black";wc.fillRect(0,0,640,360);savedRef=referenceCanvas;savedCache=flowCache;seenTarget=null;flowLocate=target=>{seenTarget=target;return {m:[1,0,10,0,1,0,0,0,1],W:640,H:360,refW:640,refH:360}}');
 assert.equal(h.run('transferToStill(work)[0].box.x0'),110);assert.equal(h.run('seenTarget===work&&savedRef===referenceCanvas&&savedCache===flowCache'),true);
});
test('invalid registration result cannot enter shared history',()=>{
 const h=setup();h.put('items',[reading()]);h.run('rememberRecognition(work,items,"live-frame");wc.fillStyle="black";wc.fillRect(0,0,640,360);flowLocate=()=>({m:[1,0,9999,0,1,0,0,0,1],W:640,H:360,refW:640,refH:360})');assert.equal(h.run('transferToStill(work).length'),0);
});
test('Focused scan retains good first reading over weak last variant',()=>{
 const h=setup();h.put('observations',[reading('ください',95,undefined,{pass:0}),reading('ください',90,undefined,{pass:1}),reading('くだざい',40,undefined,{pass:2})]);
 h.run('focused=[];mergeFocused(focused,observations,{id:1},"still-1")');assert.equal(h.run('focused.length'),1);assert.equal(h.run('focused[0].text'),'ください');assert.equal(h.run('focused[0].votes'),1);
});
test('weak focus conflict cannot erase an existing focused reading',()=>{
 const h=setup();h.put('items',[reading('ください',90,undefined,{focused:true})]);h.put('observations',[reading('くだざい',70,undefined,{pass:0})]);
 assert.equal(h.run('mergeFocused(items,observations,{id:2},"still-1")'),0);assert.equal(h.run('items[0].text'),'ください');
});
test('Focused scan does not remove unrelated regions',()=>{
 const h=setup();h.put('items',[reading('こんにちは',90,{x0:100,y0:200,x1:300,y1:230})]);h.put('observations',[reading('ください',95,undefined,{pass:0})]);
 h.run('mergeFocused(items,observations,{id:1},"still-1")');assert.equal(h.run('items.length'),2);
});
test('automatic frozen variants cannot overwrite explicit focused results',()=>{
 const h=setup();h.put('items',[reading('ください',90,undefined,{focused:true})]);h.put('candidate',[reading('くだざい',99)]);
 h.run('stillMerge(items,candidate,"still-1")');assert.equal(h.run('items[0].text'),'ください');
});
test('focus crop edge clipping records exact rounded x/y scaling',()=>{
 const h=setup();const c=json(h.run('(()=>{const c=focusCrop(work,{x:.99,y:.99,selection:{x0:.8,x1:.99,y0:.9,y1:.99}});return {x0:c.x0,y0:c.y0,region:c.region,scaleX:c.scaleX,scaleY:c.scaleY,width:c.canvas.width,height:c.canvas.height}})()'));
 assert.ok(c.x0>=0&&c.y0>=0&&c.region.x1<=640&&c.region.y1<=360);assert.ok(Math.abs(c.scaleX-c.width/(c.region.x1-c.region.x0))<1e-12);assert.ok(Math.abs(c.scaleY-c.height/(c.region.y1-c.region.y0))<1e-12);
});
test('zoomed and panned screen point maps back to original image',()=>{
 const h=setup();h.run('zoom=2;zoomX=40;zoomY=-20');const point=json(h.run('focusImagePoint(450,220)'));assert.ok(Math.abs(point.x-.5625)<1e-9);assert.ok(Math.abs(point.y-.5555555555555556)<1e-9);
});
test('overlay CSS is not scaled a second time by zoomed getBoundingClientRect',()=>{
 const h=setup();h.get('video').getBoundingClientRect=()=>({width:1280,height:720});h.run('alignOverlay()');assert.equal(h.get('overlay').style.width,'100%');
});
test('Guides in Still paints current Still items instead of clearing them',()=>{
 const h=setup();h.put('items',[reading('ねこ いぬ')]);h.run('stillMode=true;stillSource=work;stillItems=items');h.emit('debug','click',{});assert.ok(h.drawn.includes('neko inu'));
});
test('Live scan cannot enter while Still owns worker',async()=>{
 const h=setup();let calls=0;installWorker(h,async()=>{calls++;return {data:data([])}});h.run('stillBusy=true');await h.run('scan()');assert.equal(calls,0);
});
test('entering Still does not overwrite an in-flight Live work canvas',()=>{
 const h=setup();h.run('busy=true;wc.fillStyle="red";wc.fillRect(0,0,640,360);enterStill()');assert.equal(h.run('wc.getImageData(0,0,1,1).data[1]'),0);assert.equal(h.run('stillPending'),true);
});
test('returning from Still restarts tracking timer',()=>{
 const h=setup();h.run('stillMode=true;stillSource=work;exitStill()');assert.ok([...h.timers.values()].some(t=>t.fn.name==='trackTick'));
});
test('full Live→Still→Live keeps snapshot and evidence for the same image',()=>{
 const h=setup();h.put('items',[reading('ください',90,undefined,{state:'confirmed',support:{'ください':{groups:['a','b'],confidence:90}}})]);h.run('rememberRecognition(work,items,"live-frame");enterStill()');assert.equal(h.run('stillItems[0].text'),'ください');h.run('exitStill()');assert.equal(h.run('referenceItems[0].text'),'ください');assert.equal(h.run('protectedKana[0].support["ください"].groups.length'),2);
});
test('Still→Live does not lose inherited result to first low-confidence Live OCR',async()=>{
 const h=setup();h.put('items',[reading('ください',90,undefined,{state:'confirmed',support:{'ください':{groups:['a','b'],confidence:90}}})]);h.run('stillMode=true;stillSource=work;stillItems=items;exitStill();reverseScanCount=1;largeBandScanCount=1');
 installWorker(h,async()=>({data:data([reading('くだざい',45),reading('こんにちは',90,{x0:100,y0:210,x1:300,y1:240})])}));
 await h.run('scan()');assert.equal(h.run('sharedRecognition.items.find(x=>x.box.y0===100).text'),'ください');
});
test('late result from cancelled Live scan cannot publish into Still',async()=>{
 const h=setup(),d=deferred();installWorker(h,()=>d.promise);const p=h.run('scan()');h.run('enterStill()');d.resolve({data:data([reading()])});await p;assert.equal(h.run('stillItems.length'),0);assert.equal(h.run('busy'),false);assert.ok([...h.timers.values()].some(t=>t.fn.name==='stillScan'));
});
test('exiting Still mid-OCR serializes worker and schedules Live after cleanup',async()=>{
 const h=setup(),d=deferred();let calls=0;installWorker(h,()=>{calls++;return d.promise});h.run('stillMode=true;stillSource=work');const p=h.run('stillScan()');await Promise.resolve();h.run('exitStill()');await h.run('scan()');assert.equal(calls,1);d.resolve({data:data([reading()])});await p;assert.equal(h.run('sharedRecognition.items.length'),0);assert.ok([...h.timers.values()].some(t=>t.fn.name==='scan'));
});
test('quick Still→Live→Still cannot strand pending analysis',async()=>{
 const h=setup(),d=deferred();installWorker(h,()=>d.promise);h.run('stillMode=true;stillSource=work');const p=h.run('stillScan()');await Promise.resolve();h.run('exitStill();enterStill()');for(const [id,timer] of [...h.timers])if(timer.fn.name==='stillScan'){h.timers.delete(id);await timer.fn()}d.resolve({data:data([])});await p;assert.ok([...h.timers.values()].some(t=>t.fn.name==='stillScan'));assert.equal(h.run('stillBusy'),false);
});
test('stop during Still recognition clears history and rejects late result',async()=>{
 const h=setup(),d=deferred();installWorker(h,()=>d.promise);h.run('stillMode=true;stillSource=work');const p=h.run('stillScan()');await Promise.resolve();h.get('stop').onclick();d.resolve({data:data([reading()])});await p;assert.equal(h.run('active'),false);assert.equal(h.run('sharedRecognition.items.length'),0);assert.equal(h.run('referenceItems.length'),0);
});
test('OCR failure is visible and releases ownership',async()=>{
 const h=setup();installWorker(h,async()=>{throw Error('synthetic OCR failure')});h.run('stillMode=true;stillSource=work');await h.run('stillScan()');assert.match(h.get('status').textContent,/synthetic OCR failure/);assert.equal(h.run('stillBusy'),false);assert.equal(h.run('stillError'),true);
});
test('PSM reset failure is visible instead of silently swallowed',async()=>{
 const h=setup();h.put('mockWorker',{recognize:async()=>({data:data([])}),setParameters:async()=>{throw Error('reset failed')}});h.run('worker=mockWorker;stillMode=true;stillSource=work;stillPass=18');await h.run('stillScan()');assert.equal(h.run('stillError'),true);assert.match(h.get('status').textContent,/reset failed/);
});
test('text-only focused OCR does not invent a positioned box',async()=>{
 const h=setup();installWorker(h,async()=>({data:{text:'ください',blocks:[]}}));h.run('stillMode=true;stillSource=work;stillPass=18;focusRequest={x:.5,y:.5,id:1,run:runId}');await h.run('stillScan()');assert.equal(h.run('stillItems.length'),0);assert.match(h.get('status').textContent,/No reliable kana/);
});
test('scaled Still full-frame result is normalized back to source pixels',async()=>{
 const h=setup();installWorker(h,async image=>({data:data([reading('ください',90,{x0:image.width*.7,y0:image.height*.7,x1:image.width*.9,y1:image.height*.8})])}));h.run('stillMode=true;stillSource=work;stillPass=1;stillStale=5');await h.run('stillScan()');const box=json(h.run('stillItems[0].box'));assert.ok(Math.abs(box.x0-448)<1e-6);assert.ok(Math.abs(box.y0-252)<1e-6);
});
test('rotated retry never resizes or replaces immutable capture work pixels',async()=>{
 const h=setup();const sizes=[];installWorker(h,async image=>{if(image.width!==640||image.height!==360){sizes.push([h.run('work.width'),h.run('work.height')]);h.run('video.getContext("2d").fillStyle="black";video.getContext("2d").fillRect(0,0,640,360)')}return {data:data([])}});h.run('reverseScanCount=1;largeBandScanCount=1');await h.run('scan()');assert.ok(sizes.length>0);assert.ok(sizes.every(([w,height])=>w===640&&height===360));assert.equal(h.run('wc.getImageData(0,0,1,1).data[0]'),255);
});
test('UI markup, CSS, external scripts, free/privacy/license statements unchanged',()=>{
 const fs=require('node:fs'),h=load(),baseline=fs.readFileSync(require('node:path').join(__dirname,'fixtures/interface.html'),'utf8');assert.equal(h.html.slice(0,h.html.indexOf('<script>')),baseline);
});

test('actual three-pass Focused scan commits the best reading once',async()=>{
 const h=setup();let calls=0;
 installWorker(h,async image=>{const pass=calls++;return {data:data([reading(pass===2?'くだざい':'ください',pass===2?40:95,{x0:image.width*.25,y0:image.height*.43,x1:image.width*.75,y1:image.height*.57})])}});
 h.run('stillMode=true;stillSource=work;stillPass=18;focusRequest={x:.5,y:.5,id:7,run:runId,selection:{x0:.2,y0:.44,x1:.8,y1:.56}}');
 await h.run('stillScan()');assert.equal(calls,3);assert.equal(h.run('stillItems.length'),1);assert.equal(h.run('stillItems[0].text'),'ください');assert.equal(h.run('stillItems[0].support["ください"].groups.length'),1);
});
test('Focused scan excludes neighboring rows inside crop padding',async()=>{
 const h=setup();installWorker(h,async image=>({data:data([
  reading('ください',95,{x0:image.width*.25,y0:image.height*.43,x1:image.width*.75,y1:image.height*.57}),
  reading('こんにちは',95,{x0:image.width*.25,y0:image.height*.05,x1:image.width*.75,y1:image.height*.17})
 ])}));
 h.run('stillMode=true;stillSource=work;stillPass=18;focusRequest={x:.5,y:.5,id:7,run:runId,selection:{x0:.2,y0:.46,x1:.8,y1:.54}}');await h.run('stillScan()');assert.equal(h.run('stillItems.length'),1);assert.equal(h.run('stillItems[0].text'),'ください');
});
test('a new focus queued during Live OCR is retained for the next capture',async()=>{
 const h=setup(),d=deferred();let calls=0;const result={data:data([reading(),reading('こんにちは',90,{x0:100,y0:210,x1:300,y1:240})])};
 installWorker(h,()=>++calls===1?d.promise:Promise.resolve(result));h.run('reverseScanCount=1;largeBandScanCount=1');const p=h.run('scan()');h.run('focusRequest={x:.5,y:.5,id:55,run:runId}');d.resolve(result);await p;assert.equal(h.run('focusRequest?.id'),55);assert.ok([...h.timers.values()].some(t=>t.fn.name==='scan'&&t.delay===0));
});
test('Live focus has priority and cannot be overwritten by later broad retries',async()=>{
 const h=setup();let calls=0;installWorker(h,async image=>{calls++;return {data:data([reading(calls===1?'くだざい':'ください',calls===1?45:95,{x0:100,y0:calls===1?100:36,x1:300,y1:calls===1?130:80})])}});
 h.run('focusRequest={x:.3125,y:115/360,id:6,run:runId}');await h.run('scan()');assert.equal(calls,2);assert.equal(h.run('sharedRecognition.items.find(x=>x.focused)?.text'),'ください');
});
test('pinch gesture does not enqueue a false focused swipe',()=>{
 const h=setup();h.run('stillMode=true;stillSource=work');const event=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,target:{closest:()=>null}});
 h.emit('stage','pointerdown',event(1,150,150));h.emit('stage','pointerdown',event(2,300,150));h.emit('stage','pointermove',event(2,400,150));h.emit('stage','pointerup',event(2,400,150));h.emit('stage','pointerup',event(1,150,150));assert.equal(h.run('focusRequest'),null);assert.ok(h.run('zoom>1'));
});
test('raw OCR source never contains overlay paint or guides',async()=>{
 const h=setup();h.run('ctx.fillStyle="red";ctx.fillRect(0,0,640,360)');const colors=[];
 installWorker(h,async image=>{colors.push([...image.getContext('2d').getImageData(10,10,1,1).data]);return {data:data([reading(),reading('こんにちは',90,{x0:100,y0:210,x1:300,y1:240})])}});
 h.run('reverseScanCount=1;largeBandScanCount=1');await h.run('scan()');assert.ok(colors.length>0);assert.ok(colors.every(c=>c[0]===255&&c[1]===255&&c[2]===255));
});

test('failed focus status survives subsequent automatic refinement',async()=>{
 const h=setup();installWorker(h,async()=>({data:{text:'',blocks:[]}}));h.run('stillMode=true;stillSource=work;focusRequest={x:.5,y:.5,id:1,run:runId}');await h.run('stillScan()');assert.match(h.get('status').textContent,/No reliable kana detected in selection/);assert.equal(h.run('stillStale'),6);
});

test('short kana retain the original confidence and independent-vote confirmation threshold',()=>{
 const h=setup();h.put('low',reading('あ',65,undefined,{source:'live-1'}));h.put('high',reading('あ',95,undefined,{source:'live-1'}));
 h.run('low=evidenceMerge(low,low,"live-2");high=evidenceMerge(high,high,"live-2")');assert.equal(h.run('low.state'),'provisional');assert.equal(h.run('high.state'),'provisional');
 h.run('high=evidenceMerge(high,high,"live-3")');assert.equal(h.run('high.state'),'confirmed');
});
