import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";

// A tiny valid 2x2 PNG, provided inline so the suite needs no binary fixture.
const PNG_2x2_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAqBQMBP0Q3XwAAAABJRU5ErkJggg==";

const pngFile = (name = "photo.png") => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from(PNG_2x2_BASE64, "base64"),
});

/**
 * File signatures ("magic bytes"). A correct extension is worthless if the
 * bytes underneath disagree, which is exactly the failure these tests exist
 * to catch.
 */
const SIGNATURES = {
  png: (b) =>
    b
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  jpeg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b) =>
    b.subarray(0, 4).toString("latin1") === "RIFF" &&
    b.subarray(8, 12).toString("latin1") === "WEBP",
};

const describeBytes = (b) =>
  [...b.subarray(0, 12)].map((x) => x.toString(16).padStart(2, "0")).join(" ");

/** Downloads the prepared ZIP and returns its parsed entries. */
const downloadZip = async (page) => {
  await expect(page.locator("#downloadZipBtn")).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#downloadZipBtn").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("converted-images.zip");

  const zip = await JSZip.loadAsync(await readFile(await download.path()));
  return { zip, names: Object.keys(zip.files) };
};

const addImageAndConvert = async (page, format) => {
  await page.locator("#fileInput").setInputFiles(pngFile());
  await page.locator("#previewGrid > div").first().waitFor();
  if (format) {
    await page.locator("#formatSelect").selectOption(format);
  }
  await page.locator("#convertBtn").click();
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

/* ------------------------------------------------------------------ *
 * Upload / preview
 * ------------------------------------------------------------------ */

test("uploading an image shows a preview and hides the placeholder", async ({
  page,
}) => {
  await expect(page.locator("#previewPlaceholder")).toBeVisible();

  await page.locator("#fileInput").setInputFiles(pngFile());

  await expect(page.locator("#previewGrid > div")).toHaveCount(1);
  await expect(page.locator("#previewPlaceholder")).toBeHidden();
});

test("running the convert pipeline enables the ZIP download", async ({
  page,
}) => {
  await page.locator("#fileInput").setInputFiles(pngFile());
  await page.locator("#previewGrid > div").first().waitFor();

  await expect(page.locator("#downloadZipBtn")).toBeDisabled();
  await page.locator("#convertBtn").click();

  await expect(page.locator("#successAlert")).toBeVisible();
  await expect(page.locator("#downloadZipBtn")).toBeEnabled();
});

/* ------------------------------------------------------------------ *
 * Magic-byte validation of the actual ZIP payload
 * ------------------------------------------------------------------ */

test("PNG output is named .png AND carries a real PNG signature", async ({
  page,
}) => {
  await addImageAndConvert(page, "png");
  const { zip, names } = await downloadZip(page);

  expect(names).toEqual(["photo.png"]);

  const bytes = await zip.file("photo.png").async("nodebuffer");
  expect(
    SIGNATURES.png(bytes),
    `expected PNG signature, got: ${describeBytes(bytes)}`,
  ).toBe(true);
});

test("JPG output is named .jpg AND carries a real JPEG signature", async ({
  page,
}) => {
  await addImageAndConvert(page, "jpg");
  const { zip, names } = await downloadZip(page);

  expect(names).toEqual(["photo.jpg"]);

  const bytes = await zip.file("photo.jpg").async("nodebuffer");
  expect(
    SIGNATURES.jpeg(bytes),
    `expected JPEG signature, got: ${describeBytes(bytes)}`,
  ).toBe(true);
});

test("WEBP output is named .webp AND carries a real WEBP signature", async ({
  page,
}) => {
  await addImageAndConvert(page, "webp");
  const { zip, names } = await downloadZip(page);

  expect(names).toEqual(["photo.webp"]);

  const bytes = await zip.file("photo.webp").async("nodebuffer");
  expect(
    SIGNATURES.webp(bytes),
    `expected WEBP signature, got: ${describeBytes(bytes)}`,
  ).toBe(true);
});

/* ------------------------------------------------------------------ *
 * Capability detection: unencodable formats never reach the menu
 * ------------------------------------------------------------------ */

test("formats the browser cannot encode are removed from the menu", async ({
  page,
}) => {
  // Chromium substitutes PNG for AVIF, so the probe must drop it — while
  // leaving every format it can genuinely encode in place.
  await expect(page.locator("#formatSelect option")).toHaveCount(3);

  const values = await page
    .locator("#formatSelect option")
    .evaluateAll((options) => options.map((o) => o.value));

  expect(values).toEqual(["jpg", "png", "webp"]);
  expect(values).not.toContain("avif");
});

test("the selected format always falls back to an encodable one", async ({
  page,
}) => {
  // Whatever survives detection, the menu must never be left empty or
  // sitting on an option that was removed.
  const selected = await page.locator("#formatSelect").inputValue();
  expect(["jpg", "png", "webp"]).toContain(selected);
});

/* ------------------------------------------------------------------ *
 * Modes
 * ------------------------------------------------------------------ */

test("resize + convert mode produces a file with a valid signature", async ({
  page,
}) => {
  await page.locator("#fileInput").setInputFiles(pngFile());
  await page.locator("#previewGrid > div").first().waitFor();

  await page.locator('[data-mode="both"]').click();
  await page.locator("#resizeWidth").fill("50");
  await page.locator("#formatSelect").selectOption("png");
  await page.locator("#convertBtn").click();

  await expect(page.locator("#successAlert")).toBeVisible();
  const { zip, names } = await downloadZip(page);

  expect(names).toEqual(["photo.png"]);
  const bytes = await zip.file("photo.png").async("nodebuffer");
  expect(SIGNATURES.png(bytes)).toBe(true);
});

test("deleting the only image restores the empty state", async ({ page }) => {
  // The delete action asks for confirmation via window.confirm.
  page.on("dialog", (dialog) => dialog.accept());

  await page.locator("#fileInput").setInputFiles(pngFile());
  await expect(page.locator("#previewGrid > div")).toHaveCount(1);

  await page.locator('[data-role="delete-image"]').first().click();

  await expect(page.locator("#previewGrid > div")).toHaveCount(0);
  await expect(page.locator("#previewPlaceholder")).toBeVisible();
});
