# 🖼️ Glass Image Processor — Client-Side Batch Image Pipeline

[![CI](https://github.com/ismailbimbashov/Image-Processor/actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

A responsive, **fully client-side** batch image processor built with pure **Vanilla JavaScript (ES6 modules)** and **Tailwind CSS**, bundled by a thin **Vite** build. No framework. Images never leave the browser: every resize and format conversion happens locally on an in-memory `<canvas>`.

`Vanilla JS` · `Vite bundle` · `No CDN` · `Strict CSP` · `PWA / offline` · `Web Worker` · `Unit + Playwright E2E`

## ✨ Overview

This project processes one or many images entirely in the browser and hands you back a single ZIP. It leans on the web platform directly — `File`, `canvas.toBlob()`, `URL.createObjectURL` — while keeping the image logic separated from the DOM so it can be unit-tested in Node.

| | |
|---|---|
| **Language** | Vanilla JavaScript (ES6 modules) |
| **Build** | Vite — bundles/minifies; hashed first-party assets |
| **Styling** | Tailwind CSS (v3, compiled at build time) + a small custom stylesheet |
| **Processing** | Runs in a **Web Worker** (`OffscreenCanvas` + `createImageBitmap`), off the main thread; main-thread fallback for older browsers |
| **Packaging** | Client-side ZIP via [JSZip](https://stuk.github.io/jszip/) (bundled) |
| **Testing** | Node built-in runner (unit, in CI) + Playwright (E2E against the production build) |

> **Dependency note:** Tailwind and JSZip are **bundled locally by Vite** — the deployed app makes **no runtime CDN calls**, so nothing third-party is fetched at load. This also lets the production build ship a **strict Content-Security-Policy** with no `'unsafe-inline'` or `'unsafe-eval'`.

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
- **Off-main-thread pipeline** — decoding, resizing, encoding and ZIP assembly run in a **Web Worker** (`OffscreenCanvas` + `createImageBitmap`), so even a large batch never freezes the UI; images are processed sequentially to keep memory low, a failed image is skipped (and named in a toast), and browsers without Worker/OffscreenCanvas fall back to the same engine on the main thread.
- **Defensive decoding** — EXIF orientation is honoured (portrait photos aren't rotated), a decompression-bomb guard rejects absurdly large bitmaps, and SVG input is refused (raster-only).
- **One-click download** — all successful results are bundled into `converted-images.zip`.
- **Installable PWA** — a service worker precaches the app shell, so it **installs to the home screen and works fully offline** after the first visit (verified by an E2E test that reloads with the network killed).
- **Feedback** — spinner, live status text, toasts, and `role`-annotated success/error alerts.

## 🏛️ Architecture

The code is organised so that the **image pipeline never touches the DOM**, and the **DOM layer never touches the canvas math**. That boundary is what makes the core unit-testable without a browser.

```
index.html              # markup + Tailwind classes
public/favicon.png      # static passthrough asset (+ PWA icons)
src/
├── main.js             # composition root: state, Worker orchestration, wiring
├── styles.css          # Tailwind entry + custom animations (bundled by Vite)
├── ui/
│   ├── dom.js          #   event binding (upload, drag/drop, delegation)
│   ├── renderer.js     #   DOM rendering, object-URL previews, form reads
│   └── tabs.js         #   mode tabs (convert / resize / both)
├── engine/             # genuinely pure image pipeline — no DOM, no app state
│   ├── worker.js       #   Web Worker entry: runs the pipeline off-thread
│   ├── processor.js    #   sequential batch orchestration (createImageBitmap)
│   ├── resizer.js      #   computeResizeDimensions() + canvas resize
│   ├── capabilities.js #   startup probe: what can this browser really encode?
│   ├── limits.js       #   shared canvas ceilings (4096px edge, 16.7M px)
│   └── converter.js    #   mimeFromFormat() + canvas → Blob + substitution guard
└── utils/
    ├── zipper.js       #   filename sanitisation, dedup, shared ZIP assembly
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

```bash
npm install        # install dependencies
npm run dev        # Vite dev server with hot reload
```

For a production bundle (minified, hashed assets, strict CSP injected):

```bash
npm run build      # outputs to dist/
npm run preview    # serve the built dist/ locally
```

`dist/` is fully static — deploy it to any static host (GitHub Pages, Netlify, Cloudflare Pages). The `base: "./"` in `vite.config.js` makes it work from a sub-path too.

## 🧪 Testing

Two layers, mirroring the architecture:

### Unit tests — `tests/unit/` (in CI)

Fast tests on Node's built-in runner (`npm ci` first — the engine imports the bundled `jszip`). Because the engine is genuinely DOM-free, they cover the real pipeline logic — not just leaf helpers — with no browser:

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

Playwright drives the actual canvas pipeline in Chromium **against the real production build** (`vite build` → `vite preview`), so the strict CSP and bundled assets are exercised too. Crucially, it **unzips the downloaded ZIP and asserts the output's magic bytes** — an extension alone is not accepted as proof of format.

```bash
npm install                       # installs deps incl. @playwright/test
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
