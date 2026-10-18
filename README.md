# Kana → Romaji Camera

> **Current version (MeikiOCR):** [Open the camera](https://esakits.github.io/kana-romaji-camera/) · [Edit the current application](meikiocr-test/app.html) · [Build and deployment](meikiocr-test/README.md) · [Licenses and corresponding source](https://esakits.github.io/kana-romaji-camera/licenses/NOTICE.html).
>
> **Important:** The repository-root `index.html` is only a pointer to the live website; **it is not the camera's source**. The previous Tesseract implementation is preserved in [archive/legacy-tesseract-index.html](archive/legacy-tesseract-index.html). GitHub Pages deploys the built output from `meikiocr-test/` via [the Pages workflow](.github/workflows/pages.yml). Do not edit the archived file to customize the public app.


Public application: https://esakits.github.io/kana-romaji-camera/

The current application is built from `meikiocr-test/`: MeikiOCR Web + ONNX Runtime Web, with on-device Japanese OCR and the existing kana-to-romaji camera interface. No image-upload service or paid API is used. The previous Tesseract root implementation is archived at `archive/legacy-tesseract-index.html` for reference. The root `index.html` now points to the live site; the Pages workflow publishes only the verified `meikiocr-test/dist/` output.

## Build and verify

```sh
npm --prefix meikiocr-test ci
npm run build
npm test
```

`meikiocr-test/app.html` is the camera/controller template. The build generates its MeikiOCR controller, bundles the module Worker, validates pinned models/runtime assets, and includes license notices and corresponding source. Models are downloaded during build and served from this repository's Pages deployment.

`.github/workflows/pages.yml` gates publication on all 190 controller/adapter regressions, Chromium camera-stream integration and WebKit source-image inference. It also tests the published HTTPS application and served model/WASM hashes. `deployment.json` identifies the published commit.

The GitHub Pages build publishes the same functional application whose recognition and black-to-white label color were confirmed by the user on iPhone. Physical Android Chrome, long sessions, memory limits and varied real packaging remain unverified. Synthetic phone-sized Chromium tests are not real-phone tests. Kanji readings are not invented: the existing verified-ruby policy is preserved.

See [implementation and verification](meikiocr-test/REVIEW.md), [OCR build details](meikiocr-test/README.md), and the deployed `licenses/NOTICE.html` for the combined distribution's licenses (MeikiOCR Web GPL-3.0-only, models LGPL-3.0, runtime MIT; original application MIT).

During camera use, a fixed bottom bar exposes Stop (left) and position guides (center). The camera light is at the top of the camera view beside Scan. Normal Live view allows vertical page scrolling; Still selection and zoomed panning retain their custom gestures. Light is enabled only when the active camera track advertises torch support. Physical LED behavior requires device confirmation.

Long-vowel display: the bottom-right **aa / ā** button switches between double vowels (default) and macrons, immediately in Live and Still. The preference is saved locally. Nasal spelling is fixed: m before m/b/p, n’ before vowels/y, n otherwise. パーティー is paatii / pātī. The two modes share pronunciation; 先生 is sensee / sensē. UniDic Lite 1.0.8 supplies a checksum-verified, read-only index of 38,289 unambiguous kana pronunciation mappings. Ambiguous/unknown readings retain their vowels; this is conservative lexical segmentation, not a full morphological analyzer. Kanji/ruby policy and on-device, free operation remain unchanged. See [romanization specification](meikiocr-test/ROMANIZATION.md).

Torch/auto-exposure tracking: strong brightness changes are normalized only in the tracking buffers, while original OCR/capture pixels remain unchanged. Registered text must still have distributed, correlated structure before exposure compensation can preserve labels. Real target changes, polarity inversion and unverifiable glare are not accepted as the same target. The aa/ā and Guides buttons share a 46px square and 10px radius. The torch icon has a solid black bolt and a top-left-to-bottom-right red off slash.
