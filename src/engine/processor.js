import { applyResize } from "./resizer.js";
import { convertCanvasToBlob } from "./converter.js";
import { MAX_EDGE, MAX_PIXELS } from "./limits.js";

const decodeFile = async (file) => {
  // An object URL keeps the bytes out of the JS heap entirely; a data URL
  // would have materialised the whole file as a base64 string first.
  const url = URL.createObjectURL(file);

  try {
    const img = new Image();

    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () =>
        reject(new Error("Unable to load image for processing."));
      img.src = url;
    });

    if (typeof img.decode === "function") {
      // Guarantees the pixels are ready before the URL is revoked below.
      await img.decode().catch(() => {});
    }

    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * Pure helper: scale `width`/`height` down so the resulting canvas stays within
 * the platform's backing-store limits, preserving aspect ratio. Returns the
 * input untouched when it already fits.
 */
export const fitWithinCanvasLimits = (width, height) => {
  const scale = Math.min(
    1,
    MAX_EDGE / Math.max(width, height),
    Math.sqrt(MAX_PIXELS / (width * height)),
  );

  if (scale >= 1) {
    return { width, height };
  }

  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
};

const drawImageToCanvas = (canvas, ctx, img) => {
  if (!canvas || !ctx) {
    throw new Error("Canvas context is not available for processing.");
  }

  const sourceWidth = img.naturalWidth || img.width;
  const sourceHeight = img.naturalHeight || img.height;

  // A dimensionless SVG (or a corrupt file) would otherwise yield a 0x0
  // canvas and fail silently further down the pipeline.
  if (!sourceWidth || !sourceHeight) {
    throw new Error(
      "Image has no intrinsic dimensions. Vector files without a fixed width and height cannot be processed.",
    );
  }

  const { width, height } = fitWithinCanvasLimits(sourceWidth, sourceHeight);

  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
};

const releaseCanvas = (canvas) => {
  if (!canvas) return;
  // Zeroing the dimensions frees the backing store immediately instead of
  // holding it until the next batch reassigns it.
  canvas.width = 0;
  canvas.height = 0;
};

const buildPipeline = (
  canvas,
  ctx,
  createCanvas,
  mode,
  resizeOptions,
  conversionOptions,
) => {
  const steps = [];

  if (mode === "resize" || mode === "both") {
    steps.push(async () => {
      applyResize(canvas, ctx, resizeOptions, createCanvas);
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

      const blob = await convertCanvasToBlob(canvas, {
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
    onFileError,
    canvas,
    createCanvas,
  } = {},
) {
  const total = files?.length ?? 0;
  const results = [];

  if (!total) {
    return { results, total: 0, successCount: 0 };
  }

  if (!canvas) {
    throw new Error("Canvas is not available for image processing.");
  }

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas is not available for image processing.");
  }

  let successCount = 0;
  let index = 0;

  try {
    // Sequential batch execution using for-of to avoid memory spikes on low-end devices.
    for (const file of files) {
      index += 1;

      try {
        onProgress?.(index, total, file);

        const img = await decodeFile(file);

        drawImageToCanvas(canvas, ctx, img);

        const state = { file, outputBlob: null };

        const pipeline = buildPipeline(canvas, ctx, createCanvas, mode, resizeOptions, {
          format,
          quality,
        });

        // Execute pipeline steps sequentially for this image.
        for (const step of pipeline) {
          // Allow steps to use and mutate `state`.
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
        // A single bad file never fails the batch, but the caller owns how the
        // failure is surfaced; the engine does not report to the console.
        onFileError?.(file, error);
      }

      // Yield a macro-task between images so the browser can paint the
      // progress update and stay responsive during a large batch. Canvas work
      // is synchronous and would otherwise monopolise the main thread.
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  } finally {
    releaseCanvas(canvas);
  }

  return { results, total, successCount };
}
