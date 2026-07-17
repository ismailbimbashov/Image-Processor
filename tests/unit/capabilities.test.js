import { test } from "node:test";
import assert from "node:assert/strict";

import { detectEncodableFormats } from "../../src/engine/capabilities.js";

/**
 * Mimics a browser canvas: `substitutes` lists MIME types the encoder cannot
 * write and quietly returns PNG for — exactly what Chromium and Firefox do
 * for AVIF and GIF.
 */
const mockCanvasFactory = ({ substitutes = [], nullFor = [], noToBlob = false } = {}) => {
  const canvas = {
    width: 0,
    height: 0,
    filled: false,
    getContext: () => ({
      fillRect: () => {
        canvas.filled = true;
      },
    }),
  };

  if (!noToBlob) {
    canvas.toBlob = (cb, type) => {
      if (nullFor.includes(type)) {
        cb(null);
        return;
      }
      const actual = substitutes.includes(type) ? "image/png" : type;
      cb(new Blob([], { type: actual }));
    };
  }

  return { canvas, create: () => canvas };
};

test("drops formats the browser silently substitutes PNG for", async () => {
  const { create } = mockCanvasFactory({
    substitutes: ["image/avif", "image/gif"],
  });

  const supported = await detectEncodableFormats(create, [
    "jpg",
    "png",
    "webp",
    "avif",
  ]);

  assert.deepEqual(supported, ["jpg", "png", "webp"]);
});

test("keeps every format when the browser encodes them all", async () => {
  const { create } = mockCanvasFactory();

  const supported = await detectEncodableFormats(create, ["jpg", "png", "webp"]);

  assert.deepEqual(supported, ["jpg", "png", "webp"]);
});

test("drops formats whose encoder returns no blob at all", async () => {
  const { create } = mockCanvasFactory({ nullFor: ["image/webp"] });

  const supported = await detectEncodableFormats(create, ["png", "webp"]);

  assert.deepEqual(supported, ["png"]);
});

test("keeps all formats when toBlob is unavailable to probe with", async () => {
  // Reporting everything as broken would leave the user with an empty menu;
  // the conversion-time guard covers this case instead.
  const { create } = mockCanvasFactory({ noToBlob: true });

  const supported = await detectEncodableFormats(create, ["jpg", "avif"]);

  assert.deepEqual(supported, ["jpg", "avif"]);
});

test("probes against a canvas holding pixels, then releases it", async () => {
  const { canvas, create } = mockCanvasFactory();

  await detectEncodableFormats(create, ["png"]);

  assert.equal(canvas.filled, true, "must draw before probing");
  assert.equal(canvas.width, 0, "probe surface must be released");
  assert.equal(canvas.height, 0);
});

test("requires a createCanvas factory", async () => {
  await assert.rejects(
    () => detectEncodableFormats(undefined, ["png"]),
    /createCanvas factory must be provided/,
  );
});

test("returns an empty list for empty input without touching the canvas", async () => {
  let created = 0;
  const supported = await detectEncodableFormats(() => {
    created += 1;
    return {};
  }, []);

  assert.deepEqual(supported, []);
  assert.equal(created, 0);
});
