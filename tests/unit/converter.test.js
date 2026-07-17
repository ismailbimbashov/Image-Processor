import { test } from "node:test";
import assert from "node:assert/strict";

import {
  mimeFromFormat,
  convertCanvasToBlob,
} from "../../src/engine/converter.js";

test("mimeFromFormat maps known formats", () => {
  assert.equal(mimeFromFormat("jpg"), "image/jpeg");
  assert.equal(mimeFromFormat("jpeg"), "image/jpeg");
  assert.equal(mimeFromFormat("png"), "image/png");
  assert.equal(mimeFromFormat("webp"), "image/webp");
  assert.equal(mimeFromFormat("avif"), "image/avif");
  assert.equal(mimeFromFormat("gif"), "image/gif");
});

test("mimeFromFormat is case-insensitive", () => {
  assert.equal(mimeFromFormat("JPG"), "image/jpeg");
  assert.equal(mimeFromFormat("WebP"), "image/webp");
});

test("mimeFromFormat 'original' uses the provided original type", () => {
  assert.equal(mimeFromFormat("original", "image/gif"), "image/gif");
  // Falls back to png when no original type is known.
  assert.equal(mimeFromFormat("original"), "image/png");
});

test("mimeFromFormat defaults to png for unknown/empty formats", () => {
  assert.equal(mimeFromFormat("bmp"), "image/png");
  assert.equal(mimeFromFormat(""), "image/png");
  assert.equal(mimeFromFormat(undefined), "image/png");
});

/* ------------------------------------------------------------------ *
 * convertCanvasToBlob — the silent-substitution guard
 * ------------------------------------------------------------------ */

/** Mimics a canvas whose encoder substitutes PNG for `substitutes` types. */
const mockCanvas = ({ substitutes = [], nullFor = [] } = {}) => ({
  toBlob: (cb, type) => {
    if (nullFor.includes(type)) {
      cb(null);
      return;
    }
    const actual = substitutes.includes(type) ? "image/png" : type;
    cb(new Blob([], { type: actual }));
  },
});

test("convertCanvasToBlob rejects when the browser substitutes another format", async () => {
  // Chromium/Firefox return PNG bytes in a truthy Blob when asked for AVIF.
  const canvas = mockCanvas({ substitutes: ["image/avif"] });

  await assert.rejects(
    () => convertCanvasToBlob(canvas, { format: "avif" }),
    /Browser encoding failed\. Requested image\/avif but received image\/png\./,
  );
});

test("convertCanvasToBlob rejects a substituted GIF in resize-only mode", async () => {
  // format:"original" carries the source type through; GIF substitutes too.
  const canvas = mockCanvas({ substitutes: ["image/gif"] });

  await assert.rejects(
    () =>
      convertCanvasToBlob(canvas, {
        format: "original",
        originalType: "image/gif",
      }),
    /Requested image\/gif but received image\/png/,
  );
});

test("convertCanvasToBlob resolves when the encoder honours the request", async () => {
  const canvas = mockCanvas();

  const blob = await convertCanvasToBlob(canvas, { format: "webp" });

  assert.equal(blob.type, "image/webp");
});

test("convertCanvasToBlob accepts a MIME type differing only in case", async () => {
  // A real Blob lowercases its type, so a bare object is used here to prove the
  // guard compares case-insensitively rather than relying on that behaviour.
  const canvas = {
    toBlob: (cb) => cb({ type: "IMAGE/PNG", size: 10 }),
  };

  const blob = await convertCanvasToBlob(canvas, { format: "png" });

  assert.equal(blob.type, "IMAGE/PNG");
});

test("convertCanvasToBlob rejects when the encoder returns nothing", async () => {
  const canvas = mockCanvas({ nullFor: ["image/webp"] });

  await assert.rejects(
    () => convertCanvasToBlob(canvas, { format: "webp" }),
    /Conversion failed\. Your browser may not support this format\./,
  );
});

test("convertCanvasToBlob rejects without a canvas", async () => {
  await assert.rejects(
    () => convertCanvasToBlob(null, { format: "png" }),
    /Canvas is not available for conversion\./,
  );
});
