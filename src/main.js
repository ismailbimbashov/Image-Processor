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

let selectedFiles = [];
let currentZip = null;
currentMode = tabs?.getMode() ?? currentMode;
// Keyed by the File object itself so that two files sharing a name never
// collide (a plain name-keyed object silently overwrote duplicates).
let fileStats = new Map();

const buildInitialStats = (files) =>
  new Map(
    files.map((file) => [file, { originalBytes: file.size, newBytes: null }]),
  );

const acceptSelection = (files) => {
  selectedFiles = files;
  currentZip = null;
  renderer.setZipReady(false);
  errorHandler.clear();
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
  if (!selectedFiles || selectedFiles.length === 0) {
    return;
  }

  if (!Number.isInteger(index) || index < 0 || index >= selectedFiles.length) {
    return;
  }

  const file = selectedFiles[index];
  const name = file?.name || `image ${index + 1}`;

  // Safety confirmation
  const confirmed = window.confirm(
    `Are you sure you want to delete this image?\n\n${name}`,
  );
  if (!confirmed) {
    return;
  }

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
    showToast({
      message: "All images removed. Drop new files to start again.",
      type: "info",
      duration: 3500,
    });
    return;
  }

  renderer.renderPreview(selectedFiles, fileStats);
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

    results.forEach(({ file, blob, originalBytes, newBytes }) => {
      const finalExt = resolveTargetExtension(
        file.name,
        format,
        isFormatChangingMode,
      );
      const newName = buildTargetFileName(file.name, finalExt);
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

