const {test}=require('node:test');
const assert=require('node:assert/strict');
const {load,reading}=require('./harness.cjs');
function setup(){const h=load();h.run('active=true;work.width=640;work.height=360;wc.fillStyle="white";wc.fillRect(0,0,640,360)');return h}
test('default kana mode preserves mixed and spaced hiragana labels',()=>{
 const h=setup();assert.equal(h.run('kanaMode'),'both');h.put('items',[reading('ねこ いぬ')]);h.run('paint(items)');assert.ok(h.drawn.includes('neko inu'));
});
test('katakana-only mode preserves hiragana and repaints previous OCR without rescan',()=>{
 const h=setup();h.put('items',[reading('ねこ'),reading('テレビ',90,{x0:340,y0:100,x1:500,y1:130})]);h.run('tracks=items;paint(items)');assert.ok(h.drawn.includes('neko'));assert.ok(h.drawn.includes('terebi'));h.drawn.length=0;
 h.emit('kana-mode','click',{});assert.equal(h.run('kanaMode'),'katakana');assert.equal(h.get('kana-mode').textContent,'ア');assert.ok(h.drawn.includes('terebi'));assert.ok(!h.drawn.includes('neko'));
 h.drawn.length=0;h.emit('kana-mode','click',{});assert.equal(h.run('kanaMode'),'both');assert.ok(h.drawn.includes('neko'));assert.ok(h.drawn.includes('terebi'));
});
test('mixed text only covers katakana with observed glyph positions',()=>{
 const h=setup();h.put('mixed',reading('これはテレビです',90,{x0:100,y0:100,x1:500,y1:140},{kanaGlyphs:[{text:'これは',x0:0,x1:.3,y0:0,y1:1},{text:'テレビ',x0:.3,x1:.7,y0:0,y1:1},{text:'です',x0:.7,x1:1,y0:0,y1:1}]}));
 const x=h.run('katakanaDisplayItems([mixed])');assert.equal(x.length,1);assert.equal(x[0].text,'テレビ');assert.ok(Math.abs(x[0].box.x0-220)<.01);assert.ok(Math.abs(x[0].box.x1-380)<.01);assert.equal(h.run('mixed.text'),'これはテレビです');
 assert.equal(h.run('katakanaDisplayItems([{...mixed,kanaGlyphs:null}]).length'),0);
});
test('still mode retains branding and has its own dedicated close row',()=>{
 const h=setup();assert.ok(h.html.includes('body.camera-still header .topbar{visibility:visible'));assert.ok(h.html.includes('id="kana-mode"'));assert.ok(h.html.includes('body.camera-still header .topbar #stop{display:none'));
});
