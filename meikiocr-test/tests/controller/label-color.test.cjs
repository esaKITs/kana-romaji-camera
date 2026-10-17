const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,reading}=require('./harness.cjs');
function setup(){const h=load();h.run('active=true;work.width=640;work.height=360');return h;}
const box={x0:100,y0:100,x1:300,y1:130};
function pixel(h,x=105,y=105){return [...h.get('overlay').getContext('2d').getImageData(x,y,1,1).data].slice(0,3);}
function near(actual,expected){actual.forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<10,`${actual} != ${expected}`));}
test('paper inside the text region wins over dark strokes on its boundary',()=>{
 const h=setup();h.put('box',box);h.run('wc.fillStyle="#c7c7ba";wc.fillRect(0,0,640,360);wc.fillStyle="#694b2c";wc.fillRect(100,100,200,3);wc.fillRect(100,124,200,6);wc.fillRect(120,104,4,20)');
 near([...h.run('sampledPaperColor(box,work)')],[199,199,186]);
});
test('dark paper inside the text region wins over light boundary strokes',()=>{
 const h=setup();h.put('box',box);h.run('wc.fillStyle="#202322";wc.fillRect(0,0,640,360);wc.fillStyle="white";wc.fillRect(100,100,200,3);wc.fillRect(100,124,200,6);wc.fillRect(120,104,4,20)');
 near([...h.run('sampledPaperColor(box,work)')],[32,35,34]);
});
test("labels retain the current application's unified document palette",()=>{
 const h=setup();h.put('items',[reading('ください',90,box),reading('こんにちは',90,{x0:350,y0:100,x1:550,y1:130})]);
 h.run('const v=video.getContext("2d");v.fillStyle="#d9dad1";v.fillRect(0,0,320,360);v.fillStyle="#202322";v.fillRect(320,0,320,360);paint(items)');
 assert.deepEqual(pixel(h),pixel(h,355,105));assert.ok([[217,218,209],[32,35,34]].some(c=>c.every((v,i)=>Math.abs(pixel(h)[i]-v)<10))); 
});
test('the current video seeds one stable palette per object epoch',()=>{
 const h=setup();h.put('items',[reading('ください',90,box)]);
 h.run('wc.fillStyle="#694b2c";wc.fillRect(0,0,640,360);video.getContext("2d").fillStyle="#c7c7ba";video.getContext("2d").fillRect(0,0,640,360);paint(items)');
 near(pixel(h),[199,199,186]);
 h.run('video.getContext("2d").fillStyle="#dddddd";video.getContext("2d").fillRect(0,0,640,360);paint(items)');near(pixel(h),[199,199,186]);h.run('resetObjectState();paint(items)');near(pixel(h),[221,221,221]);
});
test('Still colors come from the frozen source while Live video changes',()=>{
 const h=setup();h.put('items',[reading('ください',90,box)]);
 h.run('stillMode=true;stillSource=document.createElement("canvas");stillSource.width=640;stillSource.height=360;const q=stillSource.getContext("2d");q.fillStyle="#dadbd2";q.fillRect(0,0,640,360);video.getContext("2d").fillStyle="black";video.getContext("2d").fillRect(0,0,640,360);paint(items)');
 near(pixel(h),[218,219,210]);
});
test('sampling at an image corner stays in bounds and preserves genuine colored paper',()=>{
 const h=setup();h.run('wc.fillStyle="#46776c";wc.fillRect(0,0,640,360)');h.put('box',{x0:0,y0:0,x1:60,y1:20});near([...h.run('sampledPaperColor(box,work)')],[70,119,108]);
});

test('a colored surrounding package cannot determine the white printed region color',()=>{
 const h=setup();h.put('box',box);h.run('wc.fillStyle="#694b2c";wc.fillRect(0,0,640,360);wc.fillStyle="#deded5";wc.fillRect(100,100,200,30);wc.fillStyle="#252525";for(let x=105;x<295;x+=25)wc.fillRect(x,103,4,24)');
 near([...h.run('sampledPaperColor(box,work)')],[222,222,213]);
});
