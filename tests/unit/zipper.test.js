import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getTargetExtension,
  sanitizeBaseName,
  buildTargetFileName,
  uniqueEntryName,
} from "../../src/utils/zipper.js";

test("getTargetExtension maps jpg and lowercases others", () => {
  assert.equal(getTargetExtension("jpg"), "jpg");
  assert.equal(getTargetExtension("PNG"), "png");
  assert.equal(getTargetExtension("WebP"), "webp");
  assert.equal(getTargetExtension("avif"), "avif");
});

test("getTargetExtension falls back to png for empty input", () => {
  assert.equal(getTargetExtension(""), "png");
  assert.equal(getTargetExtension(undefined), "png");
  assert.equal(getTargetExtension(null), "png");
});

test("sanitizeBaseName strips extension and path components", () => {
  assert.equal(sanitizeBaseName("photo.png"), "photo");
  assert.equal(sanitizeBaseName("/some/dir/photo.jpeg"), "photo");
  assert.equal(sanitizeBaseName("C:\\images\\photo.webp"), "photo");
});

test("sanitizeBaseName replaces unsafe characters", () => {
  assert.equal(sanitizeBaseName("my photo (1).png"), "my_photo_1_");
  assert.equal(sanitizeBaseName("weird*name?.jpg"), "weird_name_");
});

test("sanitizeBaseName returns a safe default for empty names", () => {
  assert.equal(sanitizeBaseName(""), "image");
  assert.equal(sanitizeBaseName(undefined), "image");
});

test("buildTargetFileName joins base name and extension", () => {
  assert.equal(buildTargetFileName("photo.png", "webp"), "photo.webp");
  assert.equal(buildTargetFileName("/a/b/pic.jpeg", "jpg"), "pic.jpg");
});

/* ------------------------------------------------------------------ *
 * uniqueEntryName — ZIP entry de-duplication (TASK-02 data loss fix)
 * ------------------------------------------------------------------ */

test("uniqueEntryName returns the name unchanged on first use", () => {
  const used = new Set();
  assert.equal(uniqueEntryName("photo.png", used), "photo.png");
  assert.ok(used.has("photo.png"));
});

test("uniqueEntryName appends an incrementing counter on collision", () => {
  const used = new Set();
  assert.equal(uniqueEntryName("photo.webp", used), "photo.webp");
  assert.equal(uniqueEntryName("photo.webp", used), "photo-2.webp");
  assert.equal(uniqueEntryName("photo.webp", used), "photo-3.webp");
});

test("uniqueEntryName keeps distinct names distinct", () => {
  const used = new Set();
  assert.equal(uniqueEntryName("a.png", used), "a.png");
  assert.equal(uniqueEntryName("b.png", used), "b.png");
  assert.equal(uniqueEntryName("a.png", used), "a-2.png");
});

test("uniqueEntryName skips counters already taken", () => {
  const used = new Set(["photo.png", "photo-2.png"]);
  assert.equal(uniqueEntryName("photo.png", used), "photo-3.png");
});

test("uniqueEntryName handles names without an extension", () => {
  const used = new Set();
  assert.equal(uniqueEntryName("README", used), "README");
  assert.equal(uniqueEntryName("README", used), "README-2");
});

test("uniqueEntryName inserts the counter before the last dot only", () => {
  const used = new Set();
  assert.equal(uniqueEntryName("archive.tar.gz", used), "archive.tar.gz");
  assert.equal(uniqueEntryName("archive.tar.gz", used), "archive.tar-2.gz");
});
