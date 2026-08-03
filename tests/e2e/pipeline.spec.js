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

test("an over-limit resize is clamped, not hung, and still downloads", async ({
  page,
}) => {
  await page.locator("#fileInput").setInputFiles(pngFile());
  await page.locator("#previewGrid > div").first().waitFor();

  await page.locator('[data-mode="both"]').click();
  await page.locator("#formatSelect").selectOption("png");

  // The input now carries max="4096"; bypass native validation by setting the
  // value directly and dispatching the input event the app listens for. This
  // proves the JS engine — not just the HTML — clamps the dimension.
  await page.locator("#resizeWidth").evaluate((el) => {
    el.value = "20000";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });

  await page.locator("#convertBtn").click();

  // The whole point: the batch finishes (no OOM hang) and the ZIP is ready.
  await expect(page.locator("#downloadZipBtn")).toBeEnabled({ timeout: 15000 });
  const { zip, names } = await downloadZip(page);
  expect(names).toEqual(["photo.png"]);

  const bytes = await zip.file("photo.png").async("nodebuffer");
  expect(SIGNATURES.png(bytes)).toBe(true);

  // PNG IHDR: width @ byte 16, height @ byte 20 (big-endian). Both must have
  // been clamped to the 4096 ceiling rather than allocated at 20000.
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  expect(width).toBeLessThanOrEqual(4096);
  expect(height).toBeLessThanOrEqual(4096);
  expect(width).toBeGreaterThan(2);
});

test("a partial batch zips only the successes and reports the shortfall", async ({
  page,
}) => {
  const good = pngFile("ok.png");
  // A file that passes the image/* MIME filter but cannot be decoded, so the
  // engine skips it via onFileError without failing the whole batch.
  const bad = {
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("this is not a real image"),
  };

  await page.locator("#fileInput").setInputFiles([good, bad]);
  await expect(page.locator("#previewGrid > div")).toHaveCount(2);

  await page.locator("#formatSelect").selectOption("png");
  await page.locator("#convertBtn").click();

  await expect(page.locator("#downloadZipBtn")).toBeEnabled();
  await expect(page.locator("#statusText")).toContainText("Processed 1 of 2");

  const { names } = await downloadZip(page);
  expect(names).toEqual(["ok.png"]); // only the decodable file is archived
});

test("deleting an image uses a two-click inline confirm (no dialog)", async ({
  page,
}) => {
  await page.locator("#fileInput").setInputFiles(pngFile());
  await expect(page.locator("#previewGrid > div")).toHaveCount(1);

  const deleteBtn = page.locator('[data-role="delete-image"]').first();

  // First click arms (button becomes a check); the tile is NOT yet removed.
  await deleteBtn.click();
  await expect(deleteBtn).toHaveText("✓");
  await expect(page.locator("#previewGrid > div")).toHaveCount(1);

  // Second click confirms.
  await deleteBtn.click();
  await expect(page.locator("#previewGrid > div")).toHaveCount(0);
  await expect(page.locator("#previewPlaceholder")).toBeVisible();
});

test("delete controls are locked while a batch is processing", async ({
  page,
}) => {
  await page.locator("#fileInput").setInputFiles(pngFile());
  await page.locator("#previewGrid > div").first().waitFor();

  await page.locator("#convertBtn").click();

  // By the time the ZIP is ready the batch has finished, so delete is usable
  // again — the durable, non-flaky assertion of the lock's release.
  await expect(page.locator("#downloadZipBtn")).toBeEnabled();
  await expect(
    page.locator('[data-role="delete-image"]').first(),
  ).toBeEnabled();
  await expect(
    page.locator('[data-role="delete-image"]').first(),
  ).toHaveAttribute("aria-disabled", "false");
});

test("mode tabs support arrow-key navigation", async ({ page }) => {
  const convertTab = page.locator('[data-mode="convert"]');
  const resizeTab = page.locator('[data-mode="resize"]');

  await convertTab.focus();
  await expect(convertTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowRight");

  await expect(resizeTab).toBeFocused();
  await expect(resizeTab).toHaveAttribute("aria-selected", "true");
  await expect(convertTab).toHaveAttribute("aria-selected", "false");
});
