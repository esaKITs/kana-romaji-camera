import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../../app.html',import.meta.url),'utf8');
const start=html.indexOf('function suppressRubyDuplicates(items){');
assert.ok(start>=0,'ruby suppression helper must exist');
const end=html.indexOf('\n}',start)+2;
assert.ok(end>start,'ruby suppression helper must be complete');
const suppress=new Function(html.slice(start,end)+';return suppressRubyDuplicates;')();
const box=(x0,y0,x1,y1)=>({x0,y0,x1,y1});
const ruby={text:'がっこう',rubyKanji:true,box:box(0,30,80,55),rubyBox:box(0,5,70,20)};
const kana=(text,b)=>({text,box:b});

test('verified ruby suppresses matching kana, retaining kanji label',()=>{
 assert.deepEqual(suppress([ruby,kana('がっこう',box(0,5,70,20))]),[ruby]);
});
test('verified ruby suppresses OCR-split kana runs',()=>{
 assert.deepEqual(suppress([ruby,kana('がっ',box(0,5,30,20)),kana('こう',box(31,5,70,20))]),[ruby]);
});
test('neighboring ordinary kana remains visible',()=>{
 const normal=kana('です',box(82,30,105,55));
 assert.deepEqual(suppress([ruby,normal]),[ruby,normal]);
});
test('unverified ruby does not suppress kana',()=>{
 const normal=kana('がっこう',box(0,5,70,20));
 assert.deepEqual(suppress([normal]),[normal]);
});
test('partially overlapping kana is not discarded',()=>{
 const normal=kana('が',box(65,5,95,20));
 assert.deepEqual(suppress([ruby,normal]),[ruby,normal]);
});
test('kanji body box is retained',()=>{
 assert.deepEqual(suppress([ruby]),[ruby]);
});
