// Real OpenCV/WASM integration. Set OPENCV_JS to the pinned 4.11 runtime.
const assert=require('node:assert/strict');
const {load,reading}=require('../tests/controller/harness.cjs');
(async()=>{
 if(!process.env.OPENCV_JS)throw Error('OPENCV_JS must point to the pinned OpenCV 4.11.0 JS runtime');
 const Module=require('node:module'),path=require('node:path'),fs=require('node:fs');
 const file=path.resolve(process.env.OPENCV_JS),runtime=new Module(file,module);
 runtime.filename=file;runtime.paths=Module._nodeModulePaths(path.dirname(file));
 runtime._compile(fs.readFileSync(file,'utf8'),file);
 const cv=await runtime.exports;
 // Browser imread only adapts a canvas to Mat; all feature, flow, homography,
 // mask, and application validation functions below are the actual runtime.
 cv.imread=canvas=>cv.matFromImageData(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height));
 function canvas(h,seed=1,dark=false){const c=h.makeCanvas(),q=c.getContext('2d');q.fillStyle=dark?'#151515':'#f5f5f5';q.fillRect(0,0,640,360);q.fillStyle=dark?'#f5f5f5':'#151515';let n=seed;const random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};for(let i=0;i<180;i++){const x=25+random()*580,y=25+random()*300;q.fillRect(x,y,4+random()*15,4+random()*15)}return c;}
 function target(h,source,angle,tx,ty){const c=h.makeCanvas(),q=c.getContext('2d');q.fillStyle='#f5f5f5';q.fillRect(0,0,640,360);q.translate(320+tx,180+ty);q.rotate(angle);q.drawImage(source,-320,-180);return c;}
 function exposure(h,source,gain,offset){const c=h.makeCanvas(),q=c.getContext('2d');q.drawImage(source,0,0);const image=q.getImageData(0,0,640,360);for(let i=0;i<image.data.length;i+=4)for(let j=0;j<3;j++)image.data[i+j]=Math.max(0,Math.min(255,image.data[i+j]*gain+offset));q.putImageData(image,0,0);return c;}
 let failures=0,total=0;
 for(const spec of [{name:'same object translated',angle:0,tx:12,ty:6},{name:'same object rotated',angle:.12,tx:0,ty:0},{name:'same object moved and rotated',angle:-.12,tx:8,ty:-5},{name:'white to black',darkTarget:true},{name:'black to white',darkSource:true},{name:'different white object',different:true},{name:'same object torch on',exposure:true,angle:0,tx:0,ty:0},{name:'same object torch off',exposure:true,off:true,angle:0,tx:0,ty:0},{name:'torch with movement',exposure:true,angle:0,tx:12,ty:6},{name:'torch with rotation',exposure:true,angle:.06,tx:0,ty:0},{name:'different object during torch change',exposure:true,different:true}]){
  total++;const h=load(),base=canvas(h,1,!!spec.darkSource);
  const source=spec.exposure?exposure(h,base,spec.off?.8:.45,spec.off?45:0):base;
  let destination=spec.darkTarget?canvas(h,1,true):spec.darkSource?canvas(h,1,false):spec.different?canvas(h,938,false):target(h,base,spec.angle,spec.tx,spec.ty);
  if(spec.exposure)destination=exposure(h,destination,spec.off?.45:.8,spec.off?0:45);
  h.put('opencv',cv);h.put('source',source);h.put('target',destination);h.put('items',[reading()]);h.run('active=true;work.width=640;work.height=360;window.cv=opencv;referenceCanvas=source;referenceItems=items;flowReset();const originalVerification=verifyRegistration;verifyRegistration=(...args)=>{lastValidation=originalVerification(...args);return lastValidation}');
  const transform=h.run('flowLocate(target)');
  try{
   if(spec.darkTarget||spec.darkSource||spec.different)assert.equal(transform,null);
   else{
    assert.ok(transform,'No transform: '+h.run('lastRegistrationStatus'));h.put('transform',transform);const actual=h.run('flowWarpBox(items[0].box,transform)');
    const c=Math.cos(spec.angle),s=Math.sin(spec.angle),pts=[[100,100],[300,100],[300,130],[100,130]].map(([x,y])=>[320+spec.tx+c*(x-320)-s*(y-180),180+spec.ty+s*(x-320)+c*(y-180)]);
    const expected={x0:Math.min(...pts.map(p=>p[0])),x1:Math.max(...pts.map(p=>p[0])),y0:Math.min(...pts.map(p=>p[1])),y1:Math.max(...pts.map(p=>p[1]))};
    for(const key of Object.keys(expected))assert.ok(Math.abs(actual[key]-expected[key])<3,`${key}: ${actual[key]} vs ${expected[key]}`);
   }
   console.log('PASS',spec.name);
  }catch(e){failures++;console.error('FAIL',spec.name,e.message,h.run('typeof lastValidation==="undefined"?null:lastValidation'))}
 }
 console.log(`Real OpenCV cases: ${total-failures}/${total} passed`);if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
