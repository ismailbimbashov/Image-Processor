# 🖼️ Glass Image Processor — Client-Side Batch Image Pipeline

[![CI](https://github.com/ismailbimbashov/Image-Processor/actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

A responsive, **fully client-side** batch image processor built with pure **Vanilla JavaScript (ES6 modules)** and **Tailwind CSS** — no framework, no build step. Images never leave the browser: every resize and format conversion happens locally on an in-memory `<canvas>`.

`Vanilla JS` · `No build step` · `Layered modules` · `Unit + Playwright E2E`

## ✨ Overview

This project processes one or many images entirely in the browser and hands you back a single ZIP. It leans on the web platform directly — `File`, `canvas.toBlob()`, `URL.createObjectURL` — while keeping the image logic separated from the DOM so it can be unit-tested in Node.

| | |
|---|---|
| **Language** | Vanilla JavaScript (ES6 modules) |
| **Build step** | None — it's a static site |
| **Styling** | Tailwind CSS (CDN) + a small custom stylesheet |
| **Processing** | `<canvas>` → `toBlob()`, resize via offscreen canvas |
| **Packaging** | Client-side ZIP via [JSZip](https://stuk.github.io/jszip/) (CDN) |
| **Testing** | Node built-in runner (unit, in CI) + Playwright (E2E, real browser) |

> **Honest dependency note:** this is *not* a zero-dependency app — it loads **Tailwind** and **JSZip** from a CDN at runtime, so it needs a network connection on first load. Everything else (the image pipeline) is hand-written and runs offline once loaded.

> **Browser encoding note:** `canvas.toBlob()` support varies by format, and browsers do **not** report a missing encoder — they quietly hand back PNG bytes instead. Measured in **Chromium and Firefox**: JPG, PNG and WEBP encode correctly, while **AVIF and GIF silently fall back to PNG** (Safari/WebKit untested). The app therefore probes the browser at startup and removes formats it cannot genuinely encode, so AVIF simply doesn't appear today — and will return by itself once a browser ships the encoder.

## 🚀 Features

- **Upload** — drag-and-drop or browse; accepts multiple image files (JPG, PNG, WEBP, GIF, or any browser-supported image type).
- **Preview grid** — each selected image is shown with its original → new size, and can be removed individually (with a confirm step).
- **Three processing modes**:
  - **Convert** — change output format only.
  - **Resize** — change dimensions (with optional aspect-ratio lock), keeping the original format.
  - **Resize + Convert** — both in a single pass.
- **Output formats** — JPG, PNG and WEBP, with a quality slider for the lossy ones. The menu is **built from what your browser can actually encode**, so a format that would be silently faked is never offered.
- **Verified encoding — two layers of defence.** The startup probe hides unencodable formats, and the converter independently compares the returned `Blob.type` against what was requested. PNG bytes can never ship under an `.avif` name.
- **Sequential batch pipeline** — images are processed one at a time to keep memory usage low on modest devices; a failed image is skipped (and named in a toast), not fatal to the batch.
- **One-click download** — all successful results are bundled into `converted-images.zip`.
- **Feedback** — spinner, live status text, toasts, and `role`-annotated success/error alerts.

## 🏛️ Architecture

The code is organised so that the **image pipeline never touches the DOM**, and the **DOM layer never touches the canvas math**. That boundary is what makes the core unit-testable without a browser.

```
index.html              # markup + Tailwind classes
style/style.css         # custom entrance / toast animations
src/
├── main.js             # composition root: app state + wiring
├── ui/
│   ├── dom.js          #   event binding (upload, drag/drop, delegation)
│   ├── renderer.js     #   DOM rendering, object-URL previews, form reads
│   └── tabs.js         #   mode tabs (convert / resize / both)
├── engine/             # genuinely pure image pipeline — no DOM, no app state
│   ├── processor.js    #   sequential batch orchestration
│   ├── resizer.js      #   computeResizeDimensions() + canvas resize
│   ├── capabilities.js #   startup probe: what can this browser really encode?
│   └── converter.js    #   mimeFromFormat() + canvas → Blob + substitution guard
└── utils/
    ├── zipper.js       #   JSZip wrapper + filename sanitisation
    ├── toast.js        #   non-blocking notifications
    └── errorHandler.js #   centralised user-facing messages
```

| Layer | Responsibility | Boundary |
|---|---|---|
| **engine** | Resize math, format→MIME mapping, canvas→Blob, batch loop | **Genuinely pure — it never references `document`.** The canvas and a `createCanvas` factory are injected by `main.js`, so the whole layer (including `applyResize`) is unit-tested in Node against mock surfaces. |
| **utils** | ZIP assembly, filename sanitisation, toasts, errors | `sanitizeBaseName` / `sanitizeExtension` / `resolveTargetExtension` are pure and tested; ZIP entry names are sanitised against path traversal. |
| **ui** | All DOM reads/writes, previews, event delegation | The only place allowed to touch the DOM. |
| **main.js** | Holds the single source of truth for selected files/stats and wires the layers together | Owns state; delegates work downward. |

## ⚡ Getting Started

The app uses native ES6 modules, which browsers refuse to load over `file://`. Serve it over HTTP:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000/>. No install or build step is required to run the app itself.

## 🧪 Testing

Two layers, mirroring the architecture:

### Unit tests — `tests/unit/` (in CI)

Fast, **dependency-free** tests on Node's built-in runner. Because the engine is genuinely DOM-free, they cover the real pipeline logic — not just leaf helpers — with no browser:

- `computeResizeDimensions` — aspect-lock, single-axis, clamping to ≥1px.
- `applyResize` — driven through an **injected mock `createCanvas` factory**, asserting the resize, the smoothing settings, and that the scratch surface is released.
- `fitWithinCanvasLimits` — Safari/iOS backing-store clamping (4096px edge, 16.7M pixels).
- `mimeFromFormat` — format→MIME mapping and fallbacks.
- `detectEncodableFormats` — the startup probe, including the silent PNG-substitution case and the "can't probe" fallback.
- `convertCanvasToBlob` — the substitution guard, driven by a mock encoder (covers AVIF *and* GIF-in-resize-mode).
- `sanitizeBaseName` / `sanitizeExtension` / `resolveTargetExtension` — filename and path-traversal hardening.

```bash
npm test
```

### End-to-end tests — `tests/e2e/` (Playwright, real browser)

Playwright drives the actual canvas pipeline in Chromium. Crucially, it **unzips the downloaded ZIP and asserts the output's magic bytes** — an extension alone is not accepted as proof of format. The config auto-starts the static server for you.

```bash
npm install                       # installs @playwright/test
npx playwright install chromium   # one-time browser download
npm run test:e2e                  # headless (starts the server for you)
npm run test:e2e:headed           # watch it run in a real browser
npm run test:e2e:ui               # interactive UI mode
```

Override the port/URL if you serve elsewhere:

```bash
PORT=5500 npm run test:e2e
# or point at an already-running server:
APP_URL=http://localhost:5500/ npx playwright test
```

| E2E test | Verifies |
|---|---|
| Upload → preview | Selecting a file renders a preview tile and hides the placeholder. |
| Convert pipeline | Running the pipeline enables the ZIP download and shows success. |
| **PNG signature** | The `.png` entry in the ZIP really starts with `\x89PNG`. |
| **JPG signature** | The `.jpg` entry really starts with `FF D8 FF`. |
| **WEBP signature** | The `.webp` entry really carries a `RIFF….WEBP` header. |
| **Capability detection** | Formats the browser can't encode are dropped from the menu (AVIF disappears in Chromium); the rest survive. |
| **Safe default** | The selected format is always one the browser can actually encode. |
| Resize + Convert | The combined mode produces a file with a valid signature. |
| Delete | Removing the only image restores the empty state. |

## 🔄 Continuous Integration

Every push and pull request to `main` runs via GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)):

- **Unit job** — the dependency-free suite on Node 18, 20, and 22.
- **E2E job** — installs Chromium and runs the full Playwright suite against a freshly served copy of the app; the HTML report is uploaded as a build artifact.

So both the pure logic *and* the real-browser pipeline are verified on every push.

## 📄 License

MIT License This project is free to use and open source under the MIT License – feel free to fork, modify, and distribute it as you wish.
