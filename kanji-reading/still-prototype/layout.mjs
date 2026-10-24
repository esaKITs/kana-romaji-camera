// Horizontal Still allocator. Measurement is injected so geometry can be tested
// independently of fonts. Never borrow pixels occupied by preserved glyphs.
const overlap=(a,b)=>Math.min(a.x1,b.x1)>Math.max(a.x0,b.x0)&&Math.min(a.y1,b.y1)>Math.max(a.y0,b.y0);
function rowsFor(text,measure){
 const chars=[...text];let best=null;
 for(let i=1;i<chars.length;i++){
  const rows=[chars.slice(0,i).join(''),chars.slice(i).join('')];
  // Do not strand a word separator at either end.
  if(rows.some(r=>r.trim()!==r))continue;
  const width=Math.max(...rows.map(measure));
  if(!best||width<best.width)best={rows,width};
 }
 return best;
}
export function allocateLabels(result,width,height,measure,{minScale=.70}={}){
 const drawn=[],omitted=[],occupied=[];
 for(const line of result.lines){
  const labels=result.labels.filter(l=>l.lineId===line.id).sort((a,b)=>a.box.x0-b.box.x0);
  const protectedGlyphs=result.lines.flatMap(l=>l.glyphs).filter(g=>!labels.some(l=>g.box.x0>=l.box.x0-.5&&g.box.x1<=l.box.x1+.5&&g.box.y0>=l.box.y0-.5&&g.box.y1<=l.box.y1+.5));
  const font=(line.box.y1-line.box.y0)*.56;
  const cells=labels.map(label=>{
   const b=label.box,obstacles=protectedGlyphs.map(g=>g.box).filter(q=>q.y0<b.y1&&q.y1>b.y0);
   const center=(b.x0+b.x1)/2;
   return{label,left:Math.max(0,...obstacles.filter(q=>q.x1<=center).map(q=>q.x1+1)),right:Math.min(width,...obstacles.filter(q=>q.x0>=center).map(q=>q.x0-1)),blocked:obstacles.some(q=>q.x0<center&&q.x1>center)};
  });
  const groups=[];
  for(const cell of cells){const group=groups.at(-1);if(group&&group.at(-1).right===cell.right&&group[0].left===cell.left&&!cell.blocked&&!group[0].blocked)group.push(cell);else groups.push([cell]);}
  for(const group of groups){
   const left=group[0].left,right=group.at(-1).right,available=right-left,gap=2,padding=4;
   let items=group.map(c=>({...c,rows:[c.label.output],font,natural:measure(c.label.output,font)}));
   const required=()=>items.reduce((n,i)=>n+i.natural*minScale+padding,0)+gap*(items.length-1);
   if(required()>available){
    const options=items.map((item,index)=>({index,split:rowsFor(item.label.output,t=>measure(t,font*.82)),h:item.label.box.y1-item.label.box.y0})).filter(o=>o.split&&font*.82*2<=o.h).sort((a,b)=>(items[b.index].natural-b.split.width)-(items[a.index].natural-a.split.width));
    for(const option of options){if(required()<=available)break;const item=items[option.index];item.rows=option.split.rows;item.font=font*.82;item.natural=option.split.width;}
   }
   // Allocate in source order; a shared scale preserves typographic consistency.
   const natural=items.reduce((n,i)=>n+i.natural,0),scale=Math.min(1,(available-padding*items.length-gap*(items.length-1))/Math.max(1,natural));
   if(scale<minScale||group.some(c=>c.blocked)){
    // A crowded group must not suppress unrelated labels that still fit locally.
    for(const cell of group){const b=cell.label.box;const clipped={...b,x0:Math.max(b.x0,cell.left),x1:Math.min(b.x1,cell.right)};const w=clipped.x1-clipped.x0;const s=Math.min(1,(w-padding)/Math.max(1,measure(cell.label.output,font)));
     if(!cell.blocked&&s>=minScale)place(cell.label,[cell.label.output],font,s,clipped);
     else omitted.push({...cell.label,reason:cell.blocked?'protected-glyph-collision':'line-allocation-required'});
    }
    continue;
   }
   const widths=items.map(i=>i.natural*scale+padding),total=widths.reduce((a,b)=>a+b,0)+gap*(items.length-1);
   const center=(items[0].label.box.x0+items.at(-1).label.box.x1)/2;
   let low=left,high=right-total,prefix=0;
   for(let i=0;i<items.length;i++){low=Math.max(low,items[i].label.box.x0+1-prefix-widths[i]);high=Math.min(high,items[i].label.box.x1-1-prefix);prefix+=widths[i]+gap;}
   let x=low<=high?Math.max(low,Math.min(center-total/2,high)):Math.max(left,Math.min(center-total/2,right-total));
   for(let i=0;i<items.length;i++){
    const item=items[i],b=item.label.box,rect={x0:x,x1:x+widths[i],y0:Math.max(0,b.y0),y1:Math.min(height,b.y1)};
    // Keep a visible overlap with the original word to preserve correspondence.
    if(rect.x1<=b.x0||rect.x0>=b.x1)omitted.push({...item.label,reason:'source-anchor-displaced'});
    else place(item.label,item.rows,item.font,scale,rect);
    x+=widths[i]+gap;
   }
  }
 }
 function place(label,rows,font,scale,rect){
  if(occupied.some(q=>overlap(q,rect))){omitted.push({...label,reason:'label-collision'});return;}
  occupied.push(rect);drawn.push({...label,displayBox:rect,horizontalScale:scale,fontSize:font,rows});
 }
 return{drawn,omitted};
}
