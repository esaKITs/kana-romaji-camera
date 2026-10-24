// Small original-video fingerprints. This does not read the label overlay.
export function fingerprint(rgba){
 const n=rgba.length/4,gray=new Float32Array(n);let mean=0;
 for(let i=0;i<n;i++){const p=i*4;gray[i]=rgba[p]*.299+rgba[p+1]*.587+rgba[p+2]*.114;mean+=gray[i];}
 mean/=Math.max(1,n);let variance=0;for(const v of gray)variance+=(v-mean)**2;
 const contrast=Math.max(8,Math.sqrt(variance/Math.max(1,n)));
 return Float32Array.from(gray,v=>(v-mean)/contrast);
}
export function frameDistance(a,b){if(!a||!b||a.length!==b.length)return Infinity;let sum=0;for(let i=0;i<a.length;i++)sum+=Math.abs(a[i]-b[i]);return sum/Math.max(1,a.length);}
export class MotionGuard{
 constructor({threshold=.32,settleMs=350}={}){this.threshold=threshold;this.settleMs=settleMs;this.epoch=0;this.reset();}
 reset(){this.epoch++;this.last=null;this.anchor=null;this.quietSince=null;}
 observe(sample,now){
  if(!this.last){this.last=sample;this.anchor=sample;this.quietSince=now;return false;}
  const moved=frameDistance(sample,this.last)>this.threshold||frameDistance(sample,this.anchor)>this.threshold;
  this.last=sample;if(moved){this.epoch++;this.anchor=sample;this.quietSince=now;}return moved;
 }
 stable(now){return this.quietSince!==null&&now-this.quietSince>=this.settleMs;}
 accepts(captured,current,epoch,now){this.observe(current,now);return epoch===this.epoch&&this.stable(now)&&frameDistance(captured,current)<=this.threshold;}
 painted(captured){this.anchor=captured;}
}
