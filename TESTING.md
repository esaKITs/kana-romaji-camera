# Recognition repair tests

Base: esaKITs/kana-romaji-camera main, commit
`625058159d7e7000ad3a75d20e534b10717c90b6`.

## Run

Node.js 24 and npm are required. Install the **development-only** native canvas
package, then run the tests:

```sh
npm install
npm test
```

The application still runs as the original static HTML page, without npm,
backend services, credentials, new runtime libraries, or paid APIs.

The tests evaluate the complete inline application script in Node's VM. They
use real raster canvas operations (`@napi-rs/canvas` 0.1.100), a minimal DOM and
explicitly controlled timers. OCR responses and image-registration responses
are mocked where the test needs them. No test establishes real Tesseract OCR
accuracy, real OpenCV matching accuracy, Safari behavior, or camera performance.

The UI fixture is the unchanged markup/CSS/external-script prefix from the
base commit. It checks that this repair does not change the UI, external
runtime scripts, privacy claims or license notices.

To reproduce the 17 failures on the original code, first obtain `index.html`
from the base commit into an external `baseline.html` and run:

```sh
APP_HTML=/absolute/path/baseline.html node --test --test-name-pattern='enlarged OCR|crop-local|spaced kana|confirmed full phrase|evidence merge does not mutate|shared snapshot deeply|similar-looking page|Live scan cannot enter|entering Still does not overwrite|returning from Still restarts|Still→Live does not lose|quick Still→Live→Still|text-only focused|scaled Still full|rotated retry|overlay CSS|Guides in Still' tests/recognition.test.cjs
```

This command is **expected to return exit code 1** against the original code.
It must return exit code 0 with the repaired `index.html`. A nonzero exit must
never be converted to a success.

## Required real-device acceptance before publication

- iPhone Safari and desktop camera: Live first labels, Live → Still and back,
  including switching during each OCR phase and during worker initialization.
- Same page translated, tilted, rotated and viewed at different distances:
  transfer boxes should agree with the raw glyphs. A changed page or failed
  registration must not receive old boxes.
- Focus by tap and swipe at the image edges and after pinch zoom/pan. The
  selection's target row must be recognized without replacing adjacent rows.
- Confirm that a strong focused reading survives weaker later variants, and
  that a wrong reading can be corrected by a new explicit focus or independent
  captures.
- Pause/resume, rapid Live/Still toggles, Stop/Start and device orientation
  changes. No stuck analysis or duplicate OCR ownership.
- Try small furigana, dakuten, handakuten, thin Klee print and white text on a
  dark background. These are accuracy checks, not covered by mocked OCR tests.
- Slow/offline/unavailable OCR/OpenCV CDN: clear errors, no silent export of
  image data, and no stale label transplant. No cloud OCR or paid API.
- Measure memory, scan latency and battery/thermal impact on the actual phone.

Chromium execution in this environment was blocked: the browser was absent,
and its installer downloaded an invalid/truncated archive. Japanese and Klee
traineddata were also unavailable locally, so real model evaluation was not run.
