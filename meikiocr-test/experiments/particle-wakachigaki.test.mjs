import test from 'node:test';
import assert from 'node:assert/strict';
import {particleGroups,particleWakachigaki} from './particle-wakachigaki.mjs';
const t=(surface_form,pos,reading=surface_form)=>({surface_form,pos,reading});
const render=tokens=>particleGroups(tokens).map(g=>g.map(t=>t.surface_form).join('')).join(' ');
test('particle attaches to preceding noun',()=>{
 assert.equal(render([t('にほん','名詞'),t('で','助詞'),t('はたらき','動詞'),t('ます','助動詞')]),'にほんで はたらきます');
});
test('consecutive particles stay together',()=>{
 assert.equal(render([t('にほん','名詞'),t('で','助詞'),t('は','助詞'),t('はたらき','動詞'),t('ます','助動詞')]),'にほんでは はたらきます');
 assert.equal(render([t('わたし','名詞'),t('に','助詞'),t('は','助詞'),t('わかり','動詞'),t('ます','助動詞')]),'わたしには わかります');
});
test('same letters in nouns never become particles',()=>{
 assert.equal(render([t('はは','名詞'),t('は','助詞'),t('せんせい','名詞'),t('です','助動詞')]),'ははは せんせいです');
 assert.equal(render([t('がくせい','名詞'),t('です','助動詞')]),'がくせいです');
});
test('grammatical particles get pronunciation wa e o',()=>{
 const simple={わ:'wa',え:'e',お:'o',は:'ha',へ:'he',を:'wo',に:'ni',で:'de'};
 const romanize=s=>simple[s]??s;
 assert.equal(particleWakachigaki([t('はは','名詞'),t('は','助詞')],romanize),'ははwa');
 assert.equal(particleWakachigaki([t('へ','助詞'),t('を','助詞')],romanize),'eo');
});
test('non-particle homographs do not create a boundary',()=>{
 assert.equal(render([t('で','助動詞'),t('の','名詞'),t('に','名詞')]),'でのに');
});
