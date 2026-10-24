import {splitOkurigana,isHan,isTarget,modes,reviewReason} from '../lab/src/policy.mjs';
import {candidateRomanization} from '../lab/src/format.mjs';
import {romaji,rubyKanjiRomaji} from '../lab/generated/romanizer.mjs';
const union=boxes=>({x0:Math.min(...boxes.map(b=>b.x0)),y0:Math.min(...boxes.map(b=>b.y0)),x1:Math.max(...boxes.map(b=>b.x1)),y1:Math.max(...boxes.map(b=>b.y1))});
const valid=b=>Object.values(b).every(Number.isFinite)&&b.x1>b.x0&&b.y1>b.y0;
export function sourceLines(snapshot){
 return snapshot.lines.filter(l=>l.orientation!=='vertical').map((l,id)=>{
  let offset=0;const glyphs=l.glyphs.filter(g=>g.text&&g.box?.length===4).map(g=>{
   const start=offset;offset+=g.text.length;return {text:g.text,start,end:offset,confidence:g.confidence,box:{x0:g.box[0],y0:g.box[1],x1:g.box[2],y1:g.box[3]}};
  });
  if(!glyphs.length||glyphs.some(g=>!valid(g.box)))return null;
  return {id,text:glyphs.map(g=>g.text).join(''),glyphs,box:union(glyphs.map(g=>g.box))};
 }).filter(Boolean);
}
export function spanBox(line,start,end){
 const glyphs=line.glyphs.filter(g=>g.start<end&&g.end>start);
 if(!glyphs.length||glyphs[0].start!==start||glyphs.at(-1).end!==end)return null;
 return union(glyphs.map(g=>g.box));
}
export function rubyCandidates(lines){
 const candidates=[];
 for(const main of lines)for(const match of main.text.matchAll(/[\p{Script=Han}々〆]+/gu)){
  const box=spanBox(main,match.index,match.index+match[0].length);if(!box)continue;
  const h=box.y1-box.y0,w=box.x1-box.x0;
  for(const ruby of lines){
   if(ruby===main||!/^[ぁ-ゖァ-ヺー]+$/u.test(ruby.text))continue;
   const q=ruby.box,rh=q.y1-q.y0,rw=q.x1-q.x0,overlap=Math.max(0,Math.min(q.x1,box.x1)-Math.max(q.x0,box.x0));
   if(rh<h*.18||rh>h*.72||q.y1>box.y0+h*.12||box.y0-q.y1>h*.8)continue;
   if(overlap<Math.min(w,rw)*.7||overlap<w*.65||Math.abs((q.x0+q.x1-box.x0-box.x1)/2)>w*.25)continue;
   if(Math.min(...ruby.glyphs.map(g=>g.confidence??0))<.75)continue;
   candidates.push({lineId:main.id,start:match.index,end:match.index+match[0].length,source:match[0],box,rubyLineId:ruby.id,rubyBox:q,reading:ruby.text});
  }
 }
 // Neither competing bodies nor competing ruby lines may be resolved by iteration order.
 return candidates.filter(c=>candidates.filter(x=>x.rubyLineId===c.rubyLineId).length===1&&candidates.filter(x=>x.lineId===c.lineId&&x.start===c.start&&x.end===c.end).length===1);
}
export async function analyzeSnapshot(snapshot,analyze,{mode='あア漢',style='double',verifyRuby=async()=>null}={}){
 if(!modes.includes(mode))throw Error('Invalid mode');
 const lines=sourceLines(snapshot),pairs=[],candidates=rubyCandidates(lines);
 for(const c of candidates){
  const reread=await verifyRuby(c);
  if(reread?.normalize('NFC')===c.reading.normalize('NFC'))pairs.push({...c,verified:true});
 }
 const consumedRuby=new Set(candidates.map(p=>p.rubyLineId)),labels=[],withheld=[];
 for(const line of lines){
  if(consumedRuby.has(line.id))continue;
  const tokens=await analyze(line.text);
  for(const pair of pairs.filter(p=>p.lineId===line.id)){
   labels.push({source:pair.source,reading:pair.reading,output:rubyKanjiRomaji(pair.reading,style),box:pair.box,lineId:line.id,readingSource:'verified-ruby',coversRuby:false});
  }
  for(const token of tokens){
   if(pairs.some(p=>p.lineId===line.id&&token.start<p.end&&token.end>p.start)){
    // Whole-ruby spans override analyzer boundaries. Partial overlaps are withheld.
    continue;
   }
   const pair=pairs.find(p=>p.lineId===line.id&&p.start===token.start&&p.end===token.end);
   const review=pair?null:reviewReason(token);
   if(review){if(isHan(token.surface))withheld.push({surface:token.surface,reason:review});continue;}
   const reading=pair?.reading||token.reading;if(!reading)continue;
   const allTarget=[...token.surface].every(c=>isTarget(c,mode));
   let parts;
   if(allTarget)parts=[{surface:token.surface,reading,start:0,end:token.surface.length}];
   else if(token.numericValidated)parts=token.numericParts?.filter(p=>[...p.surface].every(c=>isTarget(c,mode)));
   else if(isHan(token.surface))parts=splitOkurigana(token.surface,reading)?.filter(p=>[...p.surface].every(c=>isTarget(c,mode)));
   else parts=[];
   if(!parts?.length){if(token.numericValidated)withheld.push({surface:token.surface,reason:'numeric-alignment-unresolved'});continue;}
   for(const part of parts){
    const box=spanBox(line,token.start+part.start,token.start+part.end);
    if(!box){withheld.push({surface:part.surface,reason:'glyph-alignment-unresolved'});continue;}
    const output=part===parts[0]&&allTarget&&!pair?candidateRomanization(token,style):isHan(part.surface)?rubyKanjiRomaji(part.reading,style):romaji(part.reading,style);
    if(!output)continue;
    labels.push({source:part.surface,reading:part.reading,output,box,lineId:line.id,readingSource:pair?'verified-ruby':token.readingSource||'dictionary-candidate',coversRuby:false});
   }
  }
 }
 return {mode,style,lines:lines.map(l=>({id:l.id,text:l.text,box:l.box,glyphs:l.glyphs})),pairs,labels,withheld};
}
export function renderResult(canvas,source,result){
 canvas.width=source.width;canvas.height=source.height;const ctx=canvas.getContext('2d');ctx.drawImage(source,0,0);
 const drawn=[],omitted=[],rects=[];
 for(const label of result.labels){
  const b=label.box,w=b.x1-b.x0,h=b.y1-b.y0,line=result.lines.find(l=>l.id===label.lineId);
  const font=(line?line.box.y1-line.box.y0:h)*.56;ctx.font=`700 ${font}px system-ui`;
  const natural=ctx.measureText(label.output).width,other=line?.glyphs.filter(g=>g.box.x1<=b.x0+.5||g.box.x0>=b.x1-.5)||[];
  const left=Math.min(b.x0,Math.max(4,...other.filter(g=>g.box.x1<=b.x0+.5).map(g=>g.box.x1+1)));
  const right=Math.max(b.x1,Math.min(canvas.width-4,...other.filter(g=>g.box.x0>=b.x1-.5).map(g=>g.box.x0-1)));
  const width=Math.max(w,Math.min(right-left,natural+4));
  const x=Math.max(left,Math.min((b.x0+b.x1-width)/2,right-width)),scale=Math.min(1,(width-4)/Math.max(1,natural));
  const rect={x0:x,y0:Math.max(0,b.y0-4),x1:x+width,y1:Math.min(canvas.height,b.y1+4)};
  const collides=rects.some(q=>Math.min(q.x1,rect.x1)>Math.max(q.x0,rect.x0)&&Math.min(q.y1,rect.y1)>Math.max(q.y0,rect.y0));
  if(scale<.70||collides){omitted.push({...label,displayBox:rect,horizontalScale:scale,reason:collides?'label-collision':'line-allocation-required'});continue;}
  ctx.fillStyle='#fff';ctx.fillRect(rect.x0,rect.y0,width,rect.y1-rect.y0);ctx.save();ctx.translate(x+width/2,(b.y0+b.y1)/2);ctx.scale(scale,1);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#15212a';ctx.fillText(label.output,0,0);ctx.restore();drawn.push({...label,displayBox:rect,horizontalScale:scale});rects.push(rect);
 }
 return {drawn,omitted};
}
