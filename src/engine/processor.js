import { applyResize } from "./resizer.js";
import { convertCanvasToBlob } from "./converter.js";

const hiddenCanvas = document.getElementById("hiddenCanvas");
const ctx = hiddenCanvas?.getContext("2d") ?? null;

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result);
    reader.onerror = () =>
      reject(new Error("Failed to read the selected image file."));
    reader.readAsDataURL(file);
  });

const drawImageToCanvas = (img) => {
  if (!hiddenCanvas || !ctx) {
    throw new Error("Canvas context is not available for processing.");
  }

  hiddenCanvas.width = img.width;
  hiddenCanvas.height = img.height;
  ctx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
  ctx.drawImage(img, 0, 0);
};

const buildPipeline = (mode, resizeOptions, conversionOptions) => {
  const steps = [];

  if (mode === "resize" || mode === "both") {
    steps.push(async () => {
      applyResize(hiddenCanvas, ctx, resizeOptions);
    });
  }

  // In "resize" only mode we still want a blob in the original format.
  const shouldConvert = mode === "convert" || mode === "both" || mode === "resize";

  if (shouldConvert) {
    steps.push(async (state) => {
      const { file } = state;
      const originalType =
        file?.type && file.type.startsWith("image/")
          ? file.type
          : "image/png";

      const format =
        mode === "resize" ? "original" : conversionOptions.format || "png";

      const blob = await convertCanvasToBlob(hiddenCanvas, {
        ...conversionOptions,
        format,
        originalType,
      });

      state.outputBlob = blob;
    });
  }

  return steps;
};

export async function processFilesSequential(
  files,
  {
    mode = "convert",
    format = "png",
    quality = 0.8,
    resizeOptions = {},
    onProgress,
  } = {},
) {
  const total = files?.length ?? 0;
  const results = [];

  if (!total) {
    return { results, total: 0, successCount: 0 };
  }

  if (!hiddenCanvas || !ctx) {
    throw new Error("Canvas is not available for image processing.");
  }

  let successCount = 0;
  let index = 0;

  // Sequential batch execution using for-of to avoid memory spikes on low-end devices.
  // eslint-disable-next-line no-restricted-syntax
  for (const file of files) {
    index += 1;

    try {
      onProgress?.(index, total, file);

      const dataUrl = await readFileAsDataURL(file);

      const img = new Image();

      // Load image from data URL
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () =>
          reject(new Error("Unable to load image for processing."));
        img.src = dataUrl;
      });

      drawImageToCanvas(img);

      const state = { file, outputBlob: null };

      const pipeline = buildPipeline(mode, resizeOptions, {
        format,
        quality,
      });

      // Execute pipeline steps sequentially for this image.
      // eslint-disable-next-line no-await-in-loop
      for (const step of pipeline) {
        // Allow steps to use and mutate `state`.
        // eslint-disable-next-line no-await-in-loop
        await step(state);
      }

      if (!state.outputBlob) {
        throw new Error("Processing pipeline did not produce an output blob.");
      }

      const outputBlob = state.outputBlob;
      results.push({
        file,
        blob: outputBlob,
        originalBytes: file.size,
        newBytes: outputBlob.size,
      });
      successCount += 1;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }

  return { results, total, successCount };
}

