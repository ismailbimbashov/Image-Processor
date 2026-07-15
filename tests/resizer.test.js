import { test } from "node:test";
import assert from "node:assert/strict";

import { computeResizeDimensions } from "../src/engine/resizer.js";

test("returns null when there are no source pixels", () => {
  assert.equal(computeResizeDimensions(0, 100, { targetWidth: 50 }), null);
  assert.equal(computeResizeDimensions(100, 0, { targetWidth: 50 }), null);
});

test("returns null when no target dimensions are requested", () => {
  assert.equal(computeResizeDimensions(200, 100, {}), null);
  assert.equal(
    computeResizeDimensions(200, 100, { targetWidth: null, targetHeight: null }),
    null,
  );
});

test("locks aspect ratio from width only (source 200x100)", () => {
  assert.deepEqual(
    computeResizeDimensions(200, 100, { targetWidth: 100, lockAspect: true }),
    { width: 100, height: 50 },
  );
});

test("locks aspect ratio from height only (source 200x100)", () => {
  assert.deepEqual(
    computeResizeDimensions(200, 100, { targetHeight: 50, lockAspect: true }),
    { width: 100, height: 50 },
  );
});

test("with both dims + lock, picks the fit closest to source aspect", () => {
  assert.deepEqual(
    computeResizeDimensions(200, 100, {
      targetWidth: 100,
      targetHeight: 80,
      lockAspect: true,
    }),
    { width: 100, height: 50 },
  );
});

test("without aspect lock, a single dimension keeps the other from source", () => {
  assert.deepEqual(
    computeResizeDimensions(200, 100, { targetWidth: 80, lockAspect: false }),
    { width: 80, height: 100 },
  );
});

test("without aspect lock, both dimensions are honoured exactly", () => {
  assert.deepEqual(
    computeResizeDimensions(200, 100, {
      targetWidth: 80,
      targetHeight: 80,
      lockAspect: false,
    }),
    { width: 80, height: 80 },
  );
});

test("clamps computed dimensions to a minimum of 1px", () => {
  assert.deepEqual(
    computeResizeDimensions(200, 100, { targetWidth: 0.4, lockAspect: false }),
    { width: 1, height: 100 },
  );
});
