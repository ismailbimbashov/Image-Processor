import { processFilesSequential } from "./processor.js";
import { assembleZipFromResults } from "../utils/zipper.js";

// The image pipeline runs entirely in this Worker, off the main thread, using
// OffscreenCanvas so a large batch never freezes the UI. Files are passed in by
// structured clone; the finished ZIP Blob is passed back the same way.
self.addEventListener("message", async (event) => {
  const { type, files, options } = event.data ?? {};
  if (type !== "process") return;

  const {
    mode = "convert",
    format = "png",
    quality = 0.8,
    resizeOptions = {},
  } = options ?? {};
  const changeFormat = mode === "convert" || mode === "both";
  const failures = [];

  try {
    const canvas = new OffscreenCanvas(1, 1);
    const createCanvas = () => new OffscreenCanvas(1, 1);

    const { results, total, successCount } = await processFilesSequential(files, {
      mode,
      format,
      quality,
      resizeOptions,
      canvas,
      createCanvas,
      onProgress: (index, totalCount) =>
        self.postMessage({ type: "progress", index, total: totalCount }),
      onFileError: (file, error, inputIndex) =>
        failures.push({
          inputIndex,
          name: file?.name ?? "image",
          message: error?.message ?? "Failed to process image.",
        }),
    });

    if (successCount === 0) {
      self.postMessage({
        type: "done",
        zipBlob: null,
        total,
        successCount: 0,
        stats: [],
        failures,
      });
      return;
    }

    const { zipBlob, stats } = await assembleZipFromResults(results, {
      format,
      changeFormat,
    });

    self.postMessage({ type: "done", zipBlob, total, successCount, stats, failures });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error?.message ?? "The processing pipeline failed.",
    });
  }
});
