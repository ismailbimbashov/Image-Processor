import { test, expect } from "@playwright/test";

// A tiny valid 2x2 PNG, provided inline so the suite needs no binary fixture.
const PNG_2x2_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR4nGP8z8Dwn4EIwDiqEAAqBQMBP0Q3XwAAAABJRU5ErkJggg==";

const pngFile = (name = "pixel.png") => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from(PNG_2x2_BASE64, "base64"),
});

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

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

  await page.locator("#formatSelect").selectOption("webp");
  await expect(page.locator("#downloadZipBtn")).toBeDisabled();

  await page.locator("#convertBtn").click();

  await expect(page.locator("#successAlert")).toBeVisible();
  await expect(page.locator("#downloadZipBtn")).toBeEnabled();
});

test("preparing then downloading yields converted-images.zip", async ({
  page,
}) => {
  await page.locator("#fileInput").setInputFiles(pngFile());
  await page.locator("#previewGrid > div").first().waitFor();

  await page.locator("#convertBtn").click();
  await expect(page.locator("#downloadZipBtn")).toBeEnabled();

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#downloadZipBtn").click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe("converted-images.zip");
});

test("resize + convert mode processes the batch", async ({ page }) => {
  await page.locator("#fileInput").setInputFiles(pngFile());
  await page.locator("#previewGrid > div").first().waitFor();

  await page.locator('[data-mode="both"]').click();
  await page.locator("#resizeWidth").fill("50");

  await page.locator("#convertBtn").click();

  await expect(page.locator("#successAlert")).toBeVisible();
  await expect(page.locator("#downloadZipBtn")).toBeEnabled();
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
