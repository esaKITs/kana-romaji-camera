# Kana → Romaji Camera

Public application: https://esakits.github.io/kana-romaji-camera/

The current application is built from `meikiocr-test/`: MeikiOCR Web + ONNX Runtime Web, with on-device Japanese OCR and the existing kana-to-romaji camera interface. No image-upload service or paid API is used. The previously deployed Tesseract root `index.html` is retained as historical source; the Pages workflow publishes the verified `meikiocr-test/dist/` output instead.

## Build and verify

```sh
npm --prefix meikiocr-test ci
npm run build
npm test
```

`meikiocr-test/app.html` is the camera/controller template. The build generates its MeikiOCR controller, bundles the module Worker, validates pinned models/runtime assets, and includes license notices and corresponding source. Models are downloaded during build and served from this repository's Pages deployment.

`.github/workflows/pages.yml` gates publication on all 120 controller/adapter regressions, Chromium camera-stream integration and WebKit source-image inference. It also tests the published HTTPS application and served model/WASM hashes. `deployment.json` identifies the published commit.

The GitHub Pages build publishes the same functional application whose recognition and black-to-white label color were confirmed by the user on iPhone. Physical Android Chrome, long sessions, memory limits and varied real packaging remain unverified. Synthetic phone-sized Chromium tests are not real-phone tests. Kanji readings are not invented: the existing verified-ruby policy is preserved.

See [implementation and verification](meikiocr-test/REVIEW.md), [OCR build details](meikiocr-test/README.md), and the deployed `licenses/NOTICE.html` for the combined distribution's licenses (MeikiOCR Web GPL-3.0-only, models LGPL-3.0, runtime MIT; original application MIT).
