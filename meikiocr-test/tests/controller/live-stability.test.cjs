const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,reading}=require('./harness.cjs');
function setup(){const h=load();h.run(`active=true;work.width=640;work.height=360;video.getContext('2d').fillStyle='white';video.getContext('2d').fillRect(0,0,640,360);const positions=[];const originalLabelFill=ctx.fillRect.bind(ctx);ctx.fillRect=function(x,y,w,h){const m=this.getTransform();positions.push({x:m.e,y:m.f,w,h});originalLabelFill(x,y,w,h)}`);return h;}
function render(h,dx=0,dy=0,w=200,height=30){const items=[reading('ください',90,{x0:100+dx,y0:100+dy,x1:100+dx+w,y1:100+dy+height})];h.put('items',items);h.run('paint(items)');h.advance(65);return h.run('positions.at(-1)');}
function std(a){const m=a.reduce((s,x)=>s+x,0)/a.length;return Math.sqrt(a.reduce((s,x)=>s+(x-m)**2,0)/a.length);}
test('Live rendering attenuates alternating small x/y tracking noise',()=>{
 const h=setup(),out=[];for(let i=0;i<40;i++)out.push(render(h,i%2?3:-3,i%2?-2:2));
 assert.ok(std(out.slice(8).map(p=>p.x))<1.65,'x noise must fall by at least 45%');assert.ok(std(out.slice(8).map(p=>p.y))<1.1,'y noise must fall by at least 45%');
});
test('Live label dimensions do not pulse with small OCR-box changes',()=>{
 const h=setup(),out=[];for(let i=0;i<40;i++)out.push(render(h,0,0,i%2?202:198,i%2?31:29));assert.ok(std(out.slice(8).map(p=>p.w))<1.1);assert.ok(std(out.slice(8).map(p=>p.h))<.55);
});
test('deliberate large camera movement follows immediately and sustained movement has bounded lag',()=>{
 const h=setup();render(h);const moved=render(h,40,20);assert.ok(Math.abs(moved.x-240)<.01);assert.ok(Math.abs(moved.y-135)<.01);
 for(let i=1;i<=20;i++){const p=render(h,40+i*2,20+i);assert.ok(Math.abs(p.x-(240+i*2))<=4.01);assert.ok(Math.abs(p.y-(135+i))<=4.01);}
});
test('new object epoch and Still rendering do not interpolate old Live coordinates',()=>{
 const h=setup();render(h);h.run('resetObjectState()');let p=render(h,3,2);assert.ok(Math.abs(p.x-203)<.01);h.run('stillMode=true;stillSource=work');p=render(h,0,0);assert.ok(Math.abs(p.x-200)<.01);assert.ok(Math.abs(p.y-115)<.01);
});
test('resizing OCR analysis from 960 to 1280 does not shift normalized Live labels',()=>{
 const h=setup();render(h);h.run('work.width=1280;work.height=720');h.put('items',[reading('ください',90,{x0:200,y0:200,x1:600,y1:260})]);h.run('paint(items)');const p=h.run('positions.at(-1)');assert.ok(Math.abs(p.x/2-200)<.01);assert.ok(Math.abs(p.y/2-115)<.01);
});
test('display stabilization never mutates OCR evidence or shared source coordinates',()=>{
 const h=setup();render(h);const items=[reading('ください',90,{x0:103,y0:102,x1:303,y1:132})],before=JSON.stringify(items);h.put('items',items);h.run('paint(items)');assert.equal(JSON.stringify(items),before);
});
test('repeated identical readings in different rows keep their own display positions',()=>{
 const h=setup();for(let i=0;i<20;i++){const d=i%2?2:-2;h.put('items',[reading('ください',90,{x0:100+d,y0:100,x1:300+d,y1:130}),reading('ください',90,{x0:100-d,y0:220,x1:300-d,y1:250})]);h.run('paint(items)');h.advance(65);const p=h.run('positions.slice(-2)');assert.ok(Math.abs(p[0].y-115)<.01);assert.ok(Math.abs(p[1].y-235)<.01);}
});
test('joint similarity fit recovers translation, rotation and scale despite noisy points',()=>{
 const h=setup(),a=.06,scale=1.03,A=Math.cos(a)*scale,B=Math.sin(a)*scale,points=[];
 for(let y=20;y<=120;y+=20)for(let x=20;x<=160;x+=20){const n=((x*7+y*11)%13-6)*.07;points.push({x,y,u:A*x-B*y+4+n,v:B*x+A*y-3-n});}
 h.put('points',points);const m=h.run('fitTrackedSimilarity(points)');assert.ok(Math.abs(m.A-A)<.003);assert.ok(Math.abs(m.B-B)<.003);assert.ok(Math.abs(m.tx-4)<.3);assert.ok(Math.abs(m.ty+3)<.3);
});
