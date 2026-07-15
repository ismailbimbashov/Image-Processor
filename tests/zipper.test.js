import { test } from "node:test";
import assert from "node:assert/strict";

import {
  getTargetExtension,
  sanitizeBaseName,
  buildTargetFileName,
} from "../src/utils/zipper.js";

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
