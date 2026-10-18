# Independent MeikiOCR camera experiment

Production is not changed. Source template is derived from `136b066` and the original camera controller; only this directory is built. The public experiment uses MeikiOCR Web at `0431493cfc59534bdf9e48be95a9e43c21a206be` and ONNX Runtime Web 1.30.0, WASM/1 thread in a module Worker. No SharedArrayBuffer, isolation headers, WebGPU, server inference, accounts or paid API is required.

`npm ci && npm run build && npm test` builds `dist/`. Both the application and matching Worker/model/WASM files must be served on HTTPS from that directory. Hash/byte validation is mandatory. `MODEL_DIR` can point to already-verified Meiki models for local builds. The model download is 33,097,079 bytes; CPU runtime is 14,264,278 bytes. OpenCV is served locally as well (about 11MB). Model/worker initialization begins when the page opens; first labels do not wait for the old Tesseract-specific refinement retries.

Kana-to-romaji uses the original app's contextual conversion and noun dictionary. Kanji stays unchanged unless separately recognized furigana qualifies under the original rule; no unseen kanji reading is invented. Per-character Meiki geometry is adapted into contiguous kana runs with non-kana boundaries. Existing controls, Focused scan, Live/Still sharing, verified position tracking, document palette and gesture controls remain.

Tests: `npm test` runs adapter and migrated controller tests. The old fixed-interface/CDN assertion is replaced by explicit equality of CSS, camera controls and layout, with new engine/credit assertions. The old two-panel local-color and illumination recoloring tests are updated to the **current production's unified per-object palette**. Tests are not silently skipped. The original tests against the derived controller initially had 86/89 pass; 3 failed because of these intentional/current contracts. Browser scripts need Playwright and a browser; run `PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... node scripts/browser-test.mjs`. They use a canvas camera stream with real ONNX Worker inference, not mock OCR.

See `tests/browser-results.json` and `REVIEW.md` for observed results and limits. Mobile viewport emulation is not Safari or real Android verification. Initial Internet download time, mobile memory/thermal pressure, real lenses/lighting, and long-session reliability remain unverified. License originals and the corresponding source are served from `licenses/NOTICE.html`.

Deployment compatibility: the exact upstream client/worker and source maps are vendored in `vendor/meikiocr-web/` with upstream hashes/notices. NPM dependencies come only from the public registry; no GitHub Git dependency or private registry is required. This is the same code as the tested pinned package, and produced byte-identical runtime bundles after vendoring.

Large Still/Focused variants are normalized below 4 million pixels before transfer, with separate exact x/y coordinate mapping back to the original image. Alignment scripts load asynchronously so their large OpenCV download does not gate camera controls or OCR initialization.

Public experiment: https://kana-romaji-meiki-experiment.esakit.chatgpt.site/ . Detailed findings and verification limits: [REVIEW.md](REVIEW.md). Physical iPhone Safari and Android Chrome remain unverified; use the separate experiment before deciding whether to adopt it in production.
