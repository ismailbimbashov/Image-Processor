export function registerUiEvents({
  onFilesSelected,
  onFilesDropped,
  onConvertAll,
  onDownloadZip,
  onQualityInput,
  onDeleteImage,
}) {
  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const convertBtn = document.getElementById("convertBtn");
  const downloadZipBtn = document.getElementById("downloadZipBtn");
  const qualityRange = document.getElementById("qualityRange");
  const previewGrid = document.getElementById("previewGrid");

  if (!dropZone || !fileInput || !convertBtn || !downloadZipBtn) {
    // Basic guard for missing DOM; in that case we simply do not bind.
    return;
  }

  const preventDefaults = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      () => {
        dropZone.classList.add("border-emerald-400", "bg-slate-700/60");
      },
      false,
    );
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(
      eventName,
      () => {
        dropZone.classList.remove("border-emerald-400", "bg-slate-700/60");
      },
      false,
    );
  });

  const collectImageFiles = (fileList) =>
    Array.from(fileList || []).filter((file) => file.type.startsWith("image/"));

  dropZone.addEventListener("drop", (event) => {
    const dt = event.dataTransfer;
    const files = collectImageFiles(dt?.files);
    onFilesDropped?.(files);
  });

  // Keyboard activation for accessibility
  dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  // File input change
  fileInput.addEventListener("change", (event) => {
    const files = collectImageFiles(event.target.files || []);
    onFilesSelected?.(files, event.target.files);
  });

  // Quality slider
  if (qualityRange) {
    qualityRange.addEventListener("input", (event) => {
      const value = Number.parseFloat(event.target.value);
      onQualityInput?.(Number.isNaN(value) ? 0.8 : value);
    });
  }

  // Convert all
  convertBtn.addEventListener("click", () => {
    onConvertAll?.();
  });

  // Download ZIP
  downloadZipBtn.addEventListener("click", () => {
    onDownloadZip?.();
  });

  // Event delegation for delete buttons in the preview grid
  if (previewGrid) {
    previewGrid.addEventListener("click", (event) => {
      const target = event.target.closest("[data-role='delete-image']");
      if (!target || !previewGrid.contains(target)) return;

      const indexRaw = target.getAttribute("data-index");
      const index = Number.parseInt(indexRaw ?? "", 10);
      if (!Number.isInteger(index) || index < 0) return;

      onDeleteImage?.(index);
    });
  }
}

