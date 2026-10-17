const kana=/^[ぁ-ゖァ-ヺー]+$/u;
const kind=t=>kana.test(t)?'kana':/^[一-龯々〆]+$/u.test(t)?'han':/^[A-Za-z0-9]+$/.test(t)?'latin':'boundary';
const bbox=b=>({x0:b[0],y0:b[1],x1:b[2],y1:b[3]});
export function snapshotToData(snapshot){
 const lines=[];
 for(const line of snapshot.lines){
  if(line.orientation==='vertical')continue;
  const words=[];let run=null;
  const flush=()=>{if(run){run.confidence=run.sum/run.symbols.length;delete run.sum;delete run.kind;words.push(run);run=null;}};
  for(const glyph of line.glyphs){
   const b=bbox(glyph.box);
   if(!Object.values(b).every(Number.isFinite)||b.x1<=b.x0||b.y1<=b.y0){flush();continue;}
   const type=kind(glyph.text),confidence=Math.max(0,Math.min(100,glyph.confidence*100));
   if(!run||run.kind!==type||type==='boundary'){flush();run={text:'',bbox:{...b},confidence:0,sum:0,kind:type,symbols:[]};}
   run.text+=glyph.text;run.sum+=confidence;run.symbols.push({text:glyph.text,bbox:b,confidence});
   run.bbox={x0:Math.min(run.bbox.x0,b.x0),y0:Math.min(run.bbox.y0,b.y0),x1:Math.max(run.bbox.x1,b.x1),y1:Math.max(run.bbox.y1,b.y1)};
  }
  flush();if(words.length)lines.push({text:words.map(w=>w.text).join(''),bbox:bbox(line.box),words});
 }
 return {text:lines.map(l=>l.text).join('\n'),blocks:[{paragraphs:[{lines}]}]};
}
export function createAdapter(client,{onResult=()=>{},clock=()=>performance.now(),maxPixels=4000000,canvasFactory=()=>document.createElement("canvas")}={}){
 let busy=false,disposed=false,serial=0;
 return {meiki:true,async setParameters(){/* Meiki detects text lines independently of Tesseract's PSM. */},
  async recognize(image){
   if(disposed)throw Error('OCR disposed');if(busy)throw Error('OCR busy');busy=true;
   try{
    let frame=image;
    if(image.width*image.height>maxPixels){
     const scale=Math.sqrt(maxPixels/(image.width*image.height));frame=canvasFactory();
     frame.width=Math.max(1,Math.floor(image.width*scale));frame.height=Math.max(1,Math.floor(image.height*scale));
     frame.getContext('2d').drawImage(image,0,0,frame.width,frame.height);
    }
    const rgba=frame.getContext('2d',{willReadFrequently:true}).getImageData(0,0,frame.width,frame.height).data;
    const t=clock(),frameId='meiki-'+(++serial);
    let snapshot=await client.scan({frameId,width:frame.width,height:frame.height,capturedAtMs:t,rgba:rgba.buffer.slice(rgba.byteOffset,rgba.byteOffset+rgba.byteLength)},{transfer:'move'});
    if(disposed)throw Error('OCR disposed');if(snapshot.frameId!==frameId)throw Error('OCR frame mismatch');
    if(frame!==image){
     const sx=image.width/frame.width,sy=image.height/frame.height,map=b=>[b[0]*sx,b[1]*sy,b[2]*sx,b[3]*sy];
     snapshot={...snapshot,width:image.width,height:image.height,lines:snapshot.lines.map(line=>({...line,box:map(line.box),glyphs:line.glyphs.map(glyph=>({...glyph,box:map(glyph.box)}))}))};
    }
    onResult(snapshot,clock()-t);return {data:snapshotToData(snapshot)};
   }finally{busy=false;}
  },
  async terminate(){disposed=true;await client.dispose();}
 };
}
