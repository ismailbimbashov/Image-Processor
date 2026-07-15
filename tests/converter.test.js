import { test } from "node:test";
import assert from "node:assert/strict";

import { mimeFromFormat } from "../src/engine/converter.js";

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
