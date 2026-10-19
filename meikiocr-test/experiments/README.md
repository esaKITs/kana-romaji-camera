# Particle-aware wakachigaki — isolated experiment

This is **not integrated into the camera**. It consumes morphological token records with `surface_form`, `pos` and optionally `reading`, such as those returned by kuromoji.js (IPADIC). The seven target particles are で・の・に・を・が・は・へ. A particle stays with the preceding group; consecutive particles are grouped; the next non-particle begins a new group. Non-particle homographs never trigger a split. The romanization callback is supplied by the caller, so this module does not replace the app's existing vowel or Hepburn rules.

Run pure rule tests: `node --test meikiocr-test/experiments/particle-wakachigaki.test.mjs`.

**Not yet verified:** actual dictionary segmentation on kana-only OCR; word alignment back to individual camera bounding boxes; startup memory/time on iPhone; licensing and packaging of IPADIC; full browser integration. Do not publish or merge until these are checked. kuromoji.js is Apache-2.0; dictionary redistribution requires its own notice review.

Candidate: https://github.com/takuyaa/kuromoji.js (browser JS + dictionary files).
