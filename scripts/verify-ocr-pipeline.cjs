const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {load}=require('../tests/harness.cjs');
if(!process.env.OCR_FIXTURES)throw Error('OCR_FIXTURES must point to verify-tesseract.py output');
const rows=JSON.parse(fs.readFileSync(path.join(process.env.OCR_FIXTURES,'ocr-data.json'),'utf8'));assert.equal(rows.length,8);
let failures=0;
for(const row of rows){
 const h=load();h.put('ocr',row.data);
 try{const items=h.run('rebuildRows(extract(ocr,{width:720,height:130}))');assert.equal(items.length,1,JSON.stringify(Array.from(items,x=>x.text)));assert.equal(items[0].text,row.expected);h.put('items',items);h.run('work.width=720;work.height=130;paint(items)');assert.ok(h.drawn.length>0);console.log('PASS',row.image,items[0].text)}
 catch(e){failures++;console.error('FAIL',row.image,e.message)}
}
console.log(`Real OCR→extraction→row reconstruction→label pipeline: ${8-failures}/8 passed`);if(failures)process.exitCode=1;
