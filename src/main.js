import "./styles.css";
import { registerUiEvents } from "./ui/dom.js";
import { createRenderer } from "./ui/renderer.js";
import { initTabs } from "./ui/tabs.js";
import { processFilesSequential } from "./engine/processor.js";
import { detectEncodableFormats } from "./engine/capabilities.js";
import {
  createZip,
  addBlobToZip,
  generateZipBlob,
  buildTargetFileName,
  getTargetExtension,
  resolveTargetExtension,
  uniqueEntryName,
} from "./utils/zipper.js";
import { ErrorHandler } from "./utils/errorHandler.js";
import { showToast } from "./utils/toast.js";

const renderer = createRenderer();
const errorHandler = new ErrorHandler(renderer);

// The engine is DOM-free; the composition root owns the canvas surfaces and
// hands them down.
const hiddenCanvas = document.getElementById("hiddenCanvas");
const createCanvas = () => document.createElement("canvas");

let currentMode = "convert";

const tabs = initTabs({
  onModeChange: (mode) => {
    currentMode = mode;
  },
});

// Hard ceiling on a single batch: enough for real use, low enough that we
// never spin up an unbounded number of object URLs or a runaway pipeline.
const MAX_FILES = 500;

let selectedFiles = [];
let currentZip = null;
let isProcessing = false;
let deletePendingTimer = null;
currentMode = tabs?.getMode() ?? currentMode;
// Keyed by the File object itself so that two files sharing a name never
// collide (a plain name-keyed object silently overwrote duplicates).
let fileStats = new Map();

const buildInitialStats = (files) =>
  new Map(
    files.map((file) => [file, { originalBytes: file.size, newBytes: null }]),
  );

const acceptSelection = (files) => {
  let accepted = files;

  if (files.length > MAX_FILES) {
    accepted = files.slice(0, MAX_FILES);
    showToast({
      message: `Too many images selected. Only the first ${MAX_FILES} were added.`,
      type: "error",
      duration: 5000,
    });
  }

  selectedFiles = accepted;
  currentZip = null;
  renderer.setZipReady(false);
  errorHandler.clear();
  clearTimeout(deletePendingTimer);
  renderer.clearDeletePending();
  fileStats = buildInitialStats(selectedFiles);
  renderer.renderPreview(selectedFiles, fileStats);
};

const handleFilesSelected = (files, originalFileList) => {
  const hasAnyFiles = (originalFileList && originalFileList.length > 0) || false;

  if (!files || files.length === 0) {
    if (hasAnyFiles) {
      // User picked something, but none were valid images.
      errorHandler.invalidFilesSelected();
    }
    return;
  }

  acceptSelection(files);
};

const handleFilesDropped = (files) => {
  if (!files || files.length === 0) {
    errorHandler.dropInvalidFiles();
    return;
  }

  acceptSelection(files);
};

const handleDeleteImage = (index) => {
  // Structural edits are locked while a batch is running.
  if (isProcessing) {
    return;
  }

  if (!selectedFiles || selectedFiles.length === 0) {
    return;
  }

  if (!Number.isInteger(index) || index < 0 || index >= selectedFiles.length) {
    return;
  }

  // Non-blocking, inline confirmation: the first click arms the tile's button
  // and the second click on the same tile removes it (no synchronous
  // window.confirm freezing the event loop). Arming auto-clears after a moment.
  if (!renderer.isDeletePending(index)) {
    renderer.setDeletePending(index);
    clearTimeout(deletePendingTimer);
    deletePendingTimer = setTimeout(() => {
      renderer.clearDeletePending();
    }, 3500);
    showToast({
      message: "Click the ✓ again to remove this image.",
      type: "info",
      duration: 3000,
    });
    return;
  }

  clearTimeout(deletePendingTimer);
  renderer.clearDeletePending();

  // Remove from internal state
  selectedFiles = [
    ...selectedFiles.slice(0, index),
    ...selectedFiles.slice(index + 1),
  ];

  if (fileStats) {
    // Rebuild stats so entries for the removed file are dropped, while
    // preserving already-computed sizes for the remaining files.
    const nextStats = new Map();
    selectedFiles.forEach((f) => {
      nextStats.set(
        f,
        fileStats.get(f) ?? { originalBytes: f.size, newBytes: null },
      );
    });
    fileStats = nextStats;
  }

  // Any structural change invalidates previously prepared ZIP.
  currentZip = null;
  renderer.setZipReady(false);

  if (selectedFiles.length === 0) {
    renderer.renderPreview([], {});
    renderer.setStatus("");
    // The grid is gone; return focus to the dropzone so keyboard users keep a
    // sensible position instead of being dropped onto <body>.
    document.getElementById("dropZone")?.focus();
    showToast({
      message: "All images removed. Drop new files to start again.",
      type: "info",
      duration: 3500,
    });
    return;
  }

  renderer.renderPreview(selectedFiles, fileStats);
  // renderPreview rebuilds the grid, destroying the focused button. Move focus
  // to the tile that shifted into the deleted slot (or the new last one).
  renderer.focusDeleteButton(Math.min(index, selectedFiles.length - 1));
  showToast({
    message: "Image removed from the batch.",
    type: "info",
    duration: 2500,
  });
};

const handleQualityInput = (value) => {
  renderer.updateQualityLabel(value);
};

// Files the engine skipped are named for the user instead of being left in the
// console, so a partial batch explains itself.
const reportFileFailures = (failures) => {
  if (!failures.length) return;

  failures.forEach(({ file, error }) => {
    console.error(`[pipeline] ${file?.name ?? "image"}:`, error);
  });

  const names = failures
    .map(({ file }) => file?.name ?? "image")
    .join(", ");
  const reason =
    failures.length === 1 && typeof failures[0].error?.message === "string"
      ? ` — ${failures[0].error.message}`
      : "";

  showToast({
    message: `Skipped ${failures.length} image${failures.length === 1 ? "" : "s"}: ${names}${reason}`,
    type: "error",
    duration: 5000,
  });
};

const handleConvertAll = async () => {
  errorHandler.clear();

  if (!selectedFiles || selectedFiles.length === 0) {
    errorHandler.noFilesSelected();
    return;
  }

  const format = renderer.getSelectedFormat();
  const quality = renderer.getQualityValue();
  const isFormatChangingMode =
    currentMode === "convert" || currentMode === "both";
  const targetExt = isFormatChangingMode
    ? getTargetExtension(format)
    : null;
  const resizeOptions = renderer.getResizeOptions();

  // Lock structural edits (delete) for the duration of the batch and clear any
  // half-armed delete so it can't fire against a shifting array mid-run.
  isProcessing = true;
  clearTimeout(deletePendingTimer);
  renderer.setProcessing(true);

  renderer.setLoading(true, false);
  const targetSuffix = targetExt
    ? ` to .${targetExt}`
    : " (keeping original formats)";
  renderer.setStatus(
    `Running ${currentMode} pipeline for ${selectedFiles.length} images${targetSuffix}...`,
  );

  const failures = [];

  try {
    const { results, total, successCount } = await processFilesSequential(
      selectedFiles,
      {
        mode: currentMode,
        format,
        quality,
        resizeOptions,
        canvas: hiddenCanvas,
        createCanvas,
        onProgress: (index, totalCount) => {
          renderer.setStatus(
            `Processing ${index} of ${totalCount} images...`,
          );
        },
        onFileError: (file, error) => {
          failures.push({ file, error });
        },
      },
    );

    reportFileFailures(failures);

    if (successCount === 0) {
      renderer.setLoading(false, false);
      currentZip = null;
      renderer.setZipReady(false);
      errorHandler.allConversionsFailed();
      return;
    }

    let zip;
    try {
      zip = createZip();
    } catch (error) {
      renderer.setLoading(false, false);
      errorHandler.jsZipUnavailable(error);
      return;
    }

    const usedNames = new Set();

    results.forEach(({ file, blob, originalBytes, newBytes }) => {
      const finalExt = resolveTargetExtension(
        file.name,
        format,
        isFormatChangingMode,
      );
      // De-duplicate so two inputs sharing a basename never overwrite each
      // other in the archive (e.g. photo.webp, photo-2.webp).
      const newName = uniqueEntryName(
        buildTargetFileName(file.name, finalExt),
        usedNames,
      );
      addBlobToZip(zip, newName, blob);

      fileStats.set(file, {
        originalBytes,
        newBytes,
      });
    });

    currentZip = zip;
    renderer.setLoading(false, true);
    renderer.setZipReady(true);

    const summaryText =
      successCount === total
        ? `All ${successCount} images processed successfully. Download the ZIP when ready.`
        : `Processed ${successCount} of ${total} images. Only successful results will be included in the ZIP.`;

    renderer.setStatus(summaryText);
    renderer.renderPreview(selectedFiles, fileStats);
    renderer.showSuccess(
      "Pipeline finished. Click \"Download All as ZIP\" to save your processed images.",
    );
    showToast({
      message: "Batch pipeline completed. ZIP is ready to download.",
      type: "success",
    });
  } catch (error) {
    renderer.setLoading(false, false);
    currentZip = null;
    renderer.setZipReady(false);
    errorHandler.genericConversionError(error);
  } finally {
    // Whatever the outcome, always restore the ability to edit the batch.
    isProcessing = false;
    renderer.setProcessing(false);
  }
};

const handleDownloadZip = async () => {
  errorHandler.clear();

  if (!currentZip) {
    errorHandler.noZipReady();
    return;
  }

  renderer.setLoading(true, true);
  renderer.setStatus("Preparing ZIP file for download...");

  try {
    const blob = await generateZipBlob(currentZip);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "converted-images.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    renderer.setLoading(false, true);
    renderer.showSuccess("ZIP download started.");
    showToast({
      message: "Your ZIP download has started.",
      type: "success",
      duration: 2500,
    });
  } catch (error) {
    renderer.setLoading(false, true);
    errorHandler.zipGenerationError(error);
  }
};

registerUiEvents({
  onFilesSelected: handleFilesSelected,
  onFilesDropped: handleFilesDropped,
  onConvertAll: handleConvertAll,
  onDownloadZip: handleDownloadZip,
  onQualityInput: handleQualityInput,
  onDeleteImage: handleDeleteImage,
});

// Offering a format the browser cannot encode only ever yields an error, so the
// menu is trimmed to what this browser actually supports. The probe is driven
// from the markup rather than a hard-coded list, and re-runs on every load, so
// a format returns by itself once a browser ships its encoder.
detectEncodableFormats(createCanvas, renderer.getFormatOptions())
  .then((supported) => {
    renderer.setAvailableFormats(supported);
  })
  .catch((error) => {
    // Detection is an enhancement; the conversion-time guard is the real
    // safety net, so a failed probe leaves every option in place.
    console.warn("[capabilities] format detection failed:", error);
  });

