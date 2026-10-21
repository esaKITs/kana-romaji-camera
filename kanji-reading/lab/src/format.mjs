import {isHan} from './policy.mjs';
import {romaji,rubyKanjiRomaji} from '../generated/romanizer.mjs';
// Pronunciation selection precedes the unchanged spelling engine.
// Cross-token assimilation/long-vowel alignment is deferred to integration.
export function candidateRomanization(token,style){
 if(!token.reading)return null;
 const particle=token.pos?.includes('助詞')?({'は':'わ','へ':'え','を':'お'}[token.surface]):null;
 return isHan(token.surface)?rubyKanjiRomaji(token.reading,style):romaji(particle||token.reading,style);
}
