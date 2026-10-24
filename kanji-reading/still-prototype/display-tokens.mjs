import{isTarget,reviewReason}from'../lab/src/policy.mjs';
// Display grouping only: raw analyzer/evaluation tokens remain unchanged.
export function displayTokens(text,tokens,mode,pairs=[]){
 const output=[];
 for(const original of tokens){
  let token={...original};
  if(token.surface==='十分'&&token.reading==='ジュウブン'&&!token.unknown&&!token.pos?.includes('固有名詞')&&/^(?:に|な|だ|です|である)/.test(text.slice(token.end)))token.lexicalValidated=true;
  const previous=output.at(-1),members=previous?.members||[previous],last=members.at(-1);
  const eligible=t=>t&&t.reading&&!t.numericValidated&&!reviewReason(t)&&[...t.surface].every(c=>isTarget(c,mode))&&!pairs.some(p=>t.start<p.end&&t.end>p.start);
  const p=last?.pos||[],q=token.pos||[];
  const verbChain=members.some(t=>t?.pos?.some(x=>x==='動詞'||x==='形容詞'));
  const attach=(p[0]==='接頭詞'&&q[0]!=='助詞')||
   (verbChain&&(q[0]==='助動詞'||q[0]==='動詞'&&(q.includes('接尾')||q.includes('非自立'))||q.includes('接続助詞')&&/^[てで]$/.test(token.surface)))||
   (p[0]==='名詞'&&q[0]==='名詞'&&q.includes('接尾'))||
   (p.includes('サ変接続')&&q[0]==='動詞'&&/^(し|する|すれ|せ)$/.test(token.surface));
  if(previous&&previous.end===token.start&&eligible(previous)&&eligible(token)&&attach){
   output[output.length-1]={...previous,surface:previous.surface+token.surface,reading:previous.reading+token.reading,end:token.end,members:[...members,token],readingSource:'dictionary-display-group'};
  }else output.push(token);
 }
 return output;
}
