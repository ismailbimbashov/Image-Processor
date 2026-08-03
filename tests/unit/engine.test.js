import { test } from "node:test";
import assert from "node:assert/strict";

import { fitWithinCanvasLimits } from "../../src/engine/processor.js";
import { applyResize, computeResizeDimensions } from "../../src/engine/resizer.js";
import { MAX_EDGE, MAX_PIXELS } from "../../src/engine/limits.js";
import {
  sanitizeExtension,
  resolveTargetExtension,
} from "../../src/utils/zipper.js";

/* ------------------------------------------------------------------ *
 * fitWithinCanvasLimits — iOS/Safari backing-store clamping
 * ------------------------------------------------------------------ */

test("fitWithinCanvasLimits leaves images that already fit untouched", () => {
  assert.deepEqual(fitWithinCanvasLimits(800, 600), { width: 800, height: 600 });
  assert.deepEqual(fitWithinCanvasLimits(MAX_EDGE, 1000), {
    width: MAX_EDGE,
    height: 1000,
  });
});

test("fitWithinCanvasLimits clamps an over-long edge, preserving aspect", () => {
  // 8192x4096 -> longest edge halved to 4096, so height halves to 2048.
  assert.deepEqual(fitWithinCanvasLimits(8192, 4096), {
    width: MAX_EDGE,
    height: 2048,
  });
});

test("fitWithinCanvasLimits clamps total pixel area", () => {
  const result = fitWithinCanvasLimits(20000, 20000);
  assert.ok(
    result.width * result.height <= MAX_PIXELS,
    `expected <= ${MAX_PIXELS} pixels, got ${result.width * result.height}`,
  );
  assert.ok(result.width <= MAX_EDGE && result.height <= MAX_EDGE);
});

test("fitWithinCanvasLimits never returns a zero dimension", () => {
  const result = fitWithinCanvasLimits(100000, 1);
  assert.ok(result.width >= 1 && result.height >= 1);
});

/* ------------------------------------------------------------------ *
 * sanitizeExtension / resolveTargetExtension
 * ------------------------------------------------------------------ */

test("sanitizeExtension strips unsafe characters rather than substituting", () => {
  assert.equal(sanitizeExtension("png"), "png");
  assert.equal(sanitizeExtension("PNG"), "png");
  assert.equal(sanitizeExtension("jp g"), "jpg");
  // A separator must not survive in any form — no "_" placeholder.
  assert.equal(sanitizeExtension("../png"), "png");
  assert.equal(sanitizeExtension("..\\..\\png"), "png");
});

test("sanitizeExtension falls back to png for empty/hostile input", () => {
  assert.equal(sanitizeExtension(""), "png");
  assert.equal(sanitizeExtension("..."), "png");
  assert.equal(sanitizeExtension("/"), "png");
  assert.equal(sanitizeExtension(undefined), "png");
  assert.equal(sanitizeExtension(null), "png");
});

test("resolveTargetExtension uses the chosen format when changing format", () => {
  assert.equal(resolveTargetExtension("photo.png", "webp", true), "webp");
  assert.equal(resolveTargetExtension("photo.png", "jpg", true), "jpg");
});

test("resolveTargetExtension preserves the original extension otherwise", () => {
  assert.equal(resolveTargetExtension("photo.JPEG", "webp", false), "jpeg");
  assert.equal(resolveTargetExtension("archive.tar.gz", "webp", false), "gz");
});

test("resolveTargetExtension defaults to png when there is no extension", () => {
  assert.equal(resolveTargetExtension("photo", "webp", false), "png");
  assert.equal(resolveTargetExtension("", "webp", false), "png");
});

/* ------------------------------------------------------------------ *
 * applyResize — driven entirely through an injected canvas factory
 * ------------------------------------------------------------------ */

const createMockCtx = () => {
  const calls = [];
  return {
    calls,
    clearRect: (...args) => calls.push(["clearRect", ...args]),
    drawImage: (...args) => calls.push(["drawImage", ...args]),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: "low",
  };
};

const createMockCanvas = (width, height) => {
  const ctx = createMockCtx();
  return { width, height, getContext: () => ctx, __ctx: ctx };
};

test("applyResize resizes the canvas in place using the injected factory", () => {
  const canvas = createMockCanvas(200, 100);
  const ctx = createMockCtx();
  let created = 0;
  const offscreens = [];
  const createCanvas = () => {
    created += 1;
    const c = createMockCanvas(0, 0);
    offscreens.push(c);
    return c;
  };

  applyResize(canvas, ctx, { targetWidth: 100, lockAspect: true }, createCanvas);

  assert.equal(created, 1, "should allocate exactly one offscreen surface");
  assert.equal(canvas.width, 100);
  assert.equal(canvas.height, 50);

  // High-quality downscale settings must be applied before the final draw.
  assert.equal(ctx.imageSmoothingEnabled, true);
  assert.equal(ctx.imageSmoothingQuality, "high");

  const finalDraw = ctx.calls.find((c) => c[0] === "drawImage");
  assert.deepEqual(finalDraw.slice(2), [0, 0, 100, 50]);

  // The scratch surface must be released rather than left holding pixels.
  assert.equal(offscreens[0].width, 0);
  assert.equal(offscreens[0].height, 0);
});

test("applyResize is a no-op when no target dimensions are requested", () => {
  const canvas = createMockCanvas(200, 100);
  const ctx = createMockCtx();
  let created = 0;

  applyResize(canvas, ctx, {}, () => {
    created += 1;
    return createMockCanvas(0, 0);
  });

  assert.equal(created, 0, "must not allocate a canvas when nothing to do");
  assert.equal(canvas.width, 200);
  assert.equal(canvas.height, 100);
});

test("applyResize requires a createCanvas factory", () => {
  const canvas = createMockCanvas(200, 100);
  const ctx = createMockCtx();

  assert.throws(
    () => applyResize(canvas, ctx, { targetWidth: 50 }),
    /createCanvas factory must be provided/,
  );
});

test("applyResize rejects a missing canvas or context", () => {
  const createCanvas = () => createMockCanvas(0, 0);
  assert.throws(
    () => applyResize(null, createMockCtx(), { targetWidth: 50 }, createCanvas),
    /Canvas context is not available/,
  );
  assert.throws(
    () => applyResize(createMockCanvas(10, 10), null, { targetWidth: 50 }, createCanvas),
    /Canvas context is not available/,
  );
});

test("applyResize surfaces a failure to acquire the offscreen context", () => {
  const canvas = createMockCanvas(200, 100);
  const ctx = createMockCtx();
  const createCanvas = () => ({ width: 0, height: 0, getContext: () => null });

  assert.throws(
    () => applyResize(canvas, ctx, { targetWidth: 100 }, createCanvas),
    /offscreen canvas context/,
  );
});

/* ------------------------------------------------------------------ *
 * computeResizeDimensions — canvas-ceiling clamping (TASK-02)
 * ------------------------------------------------------------------ */

test("computeResizeDimensions clamps a 20000x10000 request to 4096x2048", () => {
  // A 2:1 target far beyond the ceiling must scale down while keeping 2:1.
  const r = computeResizeDimensions(200, 100, {
    targetWidth: 20000,
    targetHeight: 10000,
    lockAspect: false,
  });

  assert.deepEqual(r, { width: 4096, height: 2048 });
});

test("computeResizeDimensions clamps a huge aspect-locked width", () => {
  // Source 2:1, user types width 20000, aspect locked -> 20000x10000 -> clamp.
  const r = computeResizeDimensions(200, 100, {
    targetWidth: 20000,
    lockAspect: true,
  });

  assert.deepEqual(r, { width: 4096, height: 2048 });
});

test("computeResizeDimensions leaves an at-limit target untouched", () => {
  const r = computeResizeDimensions(8192, 4096, {
    targetWidth: MAX_EDGE,
    targetHeight: 2048,
    lockAspect: false,
  });

  assert.deepEqual(r, { width: MAX_EDGE, height: 2048 });
  assert.ok(r.width * r.height <= MAX_PIXELS);
});

test("computeResizeDimensions clamps a square over the pixel ceiling", () => {
  // 5000x5000 = 25M px > 16.7M ceiling, and within the edge limit, so the
  // pixel-area term (not the edge term) drives the clamp.
  const r = computeResizeDimensions(1000, 1000, {
    targetWidth: 5000,
    targetHeight: 5000,
    lockAspect: false,
  });

  assert.ok(r.width <= MAX_EDGE && r.height <= MAX_EDGE);
  assert.ok(r.width * r.height <= MAX_PIXELS, `too many px: ${r.width * r.height}`);
  assert.equal(r.width, r.height, "must stay square");
});
