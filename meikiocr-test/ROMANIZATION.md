# Romanization display contract

- Hepburn-based consonants, including shi/chi/tsu/fu/ji; loanword ti/di/fa preserved.
- Long vowels default to double vowels; the aa/ā button switches only their display.
- Both modes use identical pronunciation decisions: paatii/pātī, sensee/sensē,
  kookoo/kōkō, koohii/kōhī, obaasan/obāsan, ojiisan/ojīsan, suuji/sūji.
- Separate vowels stay separate: omou, teikuauto, oukagaishimasu, taiiku.
- No global ei/ou or adjacent-vowel replacements. Explicit long marks extend
  the corresponding preceding vowel. Dictionary-confirmed long vowels become
  length units before romanization, rather than being inferred from Latin text.
- Nasals: m before m/b/p; n’ (U+2019) before vowels/y; n elsewhere and finally.
  Explicit word spaces and punctuation prevent cross-boundary assimilation.
- Nearly touching fragments in the same explicit OCR join group can supply
  pronunciation context; kanji, independent regions and line boundaries cannot.
  Recognition text, boxes and ownership remain unchanged.
- Valid preferences persist in browser localStorage under the versioned key
  esakits.kana-romaji.long-vowels.v1; missing/invalid/blocked storage defaults
  safely to double vowels. Storage is never used for images or recognized text.
- Live and Still share the setting. Switching repaints immediately, without
  new OCR, changed evidence, image coordinates, background palette or generation.
  Delayed OCR paints with the current mode, not the mode when it was requested.

## Dictionary and limits

data/kana-pronunciations.json is generated from unidic-lite==1.0.8 by
scripts/extract-pronunciations.py. It contains 38,289 unanimous, equal-length
kana-to-pronunciation mappings differing only by vowel-to-long-mark positions.
The full BSD notice is in public/licenses/UniDic-LICENSE.txt. The build verifies
its byte length, entry count and SHA-256 against the checked-in metadata.
Building the application needs no Python or extra dictionary download.

Whole lexical readings take precedence. Conservative complete-coverage
segmentation uses this pronunciation index plus the existing reviewed kana
vocabulary and function endings. Unknown/ambiguous sequences retain vowels;
this is not a complete morphological analyzer. Explicit reviewed classroom
conventions resolve specified alternatives such as teikuauto and koori.
No pronunciation entry authorizes inferred kanji readings: existing furigana
verification remains necessary. Both modes retain this limitation.

Tests: tests/controller/romanization.test.cjs,
scripts/romanization-browser-test.mjs, and the actual-OCR toggle assertions in
scripts/browser-test.mjs. Browser automation is not physical-mobile testing.
