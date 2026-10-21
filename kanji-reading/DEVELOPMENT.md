# Kanji-reading development workspace

This directory exists **only** on the `development/kanji-reading` branch.
The stable public application remains on `main` and must not be changed during this experiment.

## Baseline / recovery

- Source repository: `esaKITs/kana-romaji-camera`
- Stable source commit: `56b3113bddc5f5893c2901d4f1955098ec3d1810`
- Immutable-by-policy recovery branch: `backup/kana-romaji-camera-stable-2026-10-21`
- Development branch: `development/kanji-reading`
- Public URL: `https://esakits.github.io/kana-romaji-camera/` (stable; no experimental deployment)
- App title **remains Kana → Romaji Camera**. A separate GitHub repository is preferred before releasing an experimental URL.

## Scope

Extend the existing on-device OCR pipeline to provide *context-sensitive kanji readings*, then pass verified readings through the **existing** kana-to-romaji conversion rules and existing positional overlay.

Keep Live, Still, katakana-only selection, long-vowel toggle, guides, flash, accessibility, camera recovery, and all current OCR regressions unchanged.

Provisional modes, to validate before UI implementation:
- Kana: hiragana and katakana to romaji
- Katakana: katakana only to romaji
- Kanji: kanji readings (output to be finalized)
- All: kana and kanji to romaji

## Implementation gates

1. **License and privacy**: verify the exact morphological-analyzer version, its dictionary, all transitively distributed components, copyright notices and license compatibility with the **existing MeikiOCR Web GPL-3.0-only** distribution. No paid/cloud services, API keys, image or OCR uploads, or new account requirements.
2. **Reading proof-of-concept**: run a morphological analyzer entirely in-browser and test ambiguous kanji in full sentences, particles, proper names, numerals and unknown words. Keep unknown readings unresolved rather than fabricate them.
3. **Positioning**: align analyzer token offsets to *real OCR symbol boxes*. Do not divide mixed-script bounding boxes into invented equal-width characters. Refuse uncertain placement.
4. **Memory**: profile iPhone Safari with existing ONNX/WASM OCR plus the reading dictionary; defer loading, share a singleton and handle background/foreground safely.
5. **Regression**: unit and browser tests for Live/Still, both vowel styles, both kana modes, ruby behavior, layout and OCR. Real-device validation before claiming iPhone stability.

## Candidate

`@faanau/kuromoji` (Apache-2.0 code) is the first *candidate*, not yet an approved dependency. Check the precise package and bundled dictionary licensing and runtime memory before installation. Kuroshiro is not needed merely to transliterate kana because the app already has its own romanization implementation.

## Publication safety

The GitHub Actions Pages workflow deploys **only `main`**. Do not change the workflow, the public branch, the public Pages settings or existing application until all gates pass and the user approves publication. Development must remain in this branch or a separately created repository.
