export function createRenderer() {
  const previewGrid = document.getElementById("previewGrid");
  const previewPlaceholder = document.getElementById("previewPlaceholder");
  const qualityValueLabel = document.getElementById("qualityValue");
  const spinner = document.getElementById("spinner");
  const statusText = document.getElementById("statusText");
  const successAlert = document.getElementById("successAlert");
  const errorAlert = document.getElementById("errorAlert");
  const convertBtn = document.getElementById("convertBtn");
  const downloadZipBtn = document.getElementById("downloadZipBtn");
  const formatSelect = document.getElementById("formatSelect");
  const qualityRange = document.getElementById("qualityRange");
  const resizeWidthInput = document.getElementById("resizeWidth");
  const resizeHeightInput = document.getElementById("resizeHeight");
  const lockAspectButton = document.getElementById("lockAspect");
  const lockAspectIcon = document.getElementById("lockAspectIcon");

  const ensure = (el, id) => {
    if (!el) {
      // Fail loudly during development if the DOM does not match expectations.
      console.warn(`[renderer] Missing element with id="${id}"`);
    }
    return el;
  };

  ensure(previewGrid, "previewGrid");
  ensure(previewPlaceholder, "previewPlaceholder");
  ensure(qualityValueLabel, "qualityValue");
  ensure(spinner, "spinner");
  ensure(statusText, "statusText");
  ensure(successAlert, "successAlert");
  ensure(errorAlert, "errorAlert");
  ensure(convertBtn, "convertBtn");
  ensure(downloadZipBtn, "downloadZipBtn");
  ensure(formatSelect, "formatSelect");
  ensure(qualityRange, "qualityRange");
  ensure(resizeWidthInput, "resizeWidth");
  ensure(resizeHeightInput, "resizeHeight");
  ensure(lockAspectButton, "lockAspect");
  ensure(lockAspectIcon, "lockAspectIcon");

  const formatBytes = (bytes) => {
    if (typeof bytes !== "number" || Number.isNaN(bytes) || bytes <= 0) {
      return "—";
    }
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  if (lockAspectButton && lockAspectIcon) {
    lockAspectButton.addEventListener("click", () => {
      const nextState =
        (lockAspectButton.dataset.state ?? "on") === "on" ? "off" : "on";
      lockAspectButton.dataset.state = nextState;
      lockAspectButton.setAttribute("data-state", nextState);
      lockAspectButton.setAttribute(
        "aria-pressed",
        nextState === "on" ? "true" : "false",
      );
      lockAspectIcon.classList.toggle("opacity-0", nextState === "off");
    });
  }

  const clearMessages = () => {
    if (successAlert) {
      successAlert.classList.add("hidden");
      successAlert.textContent =
        "Images converted successfully. You can now download the ZIP file containing all converted images.";
    }
    if (errorAlert) {
      errorAlert.classList.add("hidden");
      errorAlert.textContent = "";
    }
    if (statusText) {
      statusText.textContent = "";
    }
  };

  const clearPreviewGrid = () => {
    if (previewGrid) {
      previewGrid.innerHTML = "";
    }
  };

  const renderPreview = (files, sizeInfo = {}) => {
    clearPreviewGrid();

    if (!files || files.length === 0) {
      if (previewPlaceholder) {
        previewPlaceholder.classList.remove("hidden");
      }
      return;
    }

    if (previewPlaceholder) {
      previewPlaceholder.classList.add("hidden");
    }

    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const wrapper = document.createElement("div");
        wrapper.className =
          "relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-slate-900/60";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.setAttribute("data-role", "delete-image");
        deleteBtn.setAttribute("data-index", String(index));
        deleteBtn.className =
          "absolute right-1.5 top-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-950/90 text-slate-100 text-xs shadow-md shadow-black/40 hover:bg-rose-500 hover:text-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900";
        deleteBtn.setAttribute(
          "aria-label",
          `Remove ${file.name || `image ${index + 1}`}`,
        );
        deleteBtn.textContent = "X";

        const img = document.createElement("img");
        img.src = event.target?.result;
        img.alt = file.name || `Selected image ${index + 1}`;
        img.className = "h-full w-full object-cover";

        const stats = sizeInfo?.[file.name] ?? {};
        const originalBytes =
          typeof stats.originalBytes === "number"
            ? stats.originalBytes
            : file.size;
        const newBytes = stats.newBytes;

        const infoBar = document.createElement("div");
        infoBar.className =
          "absolute inset-x-0 bottom-0 bg-slate-950/70 backdrop-blur-sm px-2 py-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-100";

        const nameEl = document.createElement("span");
        nameEl.className = "truncate max-w-[55%]";
        nameEl.textContent = file.name || `Image ${index + 1}`;

        const sizeEl = document.createElement("span");
        sizeEl.className = "ml-auto text-right text-[9px] text-slate-300";
        const originalText = formatBytes(originalBytes);
        const newText =
          typeof newBytes === "number" && newBytes > 0
            ? formatBytes(newBytes)
            : "pending";
        sizeEl.textContent = `${originalText} → ${newText}`;

        infoBar.appendChild(nameEl);
        infoBar.appendChild(sizeEl);

        wrapper.appendChild(deleteBtn);
        wrapper.appendChild(img);
        wrapper.appendChild(infoBar);
        previewGrid?.appendChild(wrapper);
      };
      reader.readAsDataURL(file);
    });
  };

  const updateQualityLabel = (value) => {
    if (qualityValueLabel) {
      qualityValueLabel.textContent = Number(value).toFixed(1);
    }
  };

  const setLoading = (isLoading, hasZipReady) => {
    if (spinner) {
      spinner.classList.toggle("hidden", !isLoading);
    }
    if (convertBtn) {
      convertBtn.disabled = !!isLoading;
    }
    if (downloadZipBtn) {
      // Only enable ZIP button when not loading and zip is ready
      downloadZipBtn.disabled = !!isLoading || !hasZipReady;
    }
  };

  const setStatus = (text) => {
    if (statusText) {
      statusText.textContent = text ?? "";
    }
  };

  const showSuccess = (message) => {
    if (successAlert) {
      if (message) {
        successAlert.textContent = message;
      }
      successAlert.classList.remove("hidden");
    }
  };

  const showError = (message) => {
    if (errorAlert) {
      errorAlert.textContent = message;
      errorAlert.classList.remove("hidden");
    }
  };

  const setZipReady = (isReady) => {
    if (downloadZipBtn) {
      downloadZipBtn.disabled = !isReady;
    }
  };

  const getSelectedFormat = () => formatSelect?.value ?? "png";

  const getQualityValue = () => {
    const raw = qualityRange?.value ?? "0.8";
    const parsed = Number.parseFloat(raw);
    return Number.isNaN(parsed) ? 0.8 : parsed;
  };

  const getResizeOptions = () => {
    const rawWidth = resizeWidthInput?.value ?? "";
    const rawHeight = resizeHeightInput?.value ?? "";

    const widthParsed = Number.parseInt(rawWidth, 10);
    const heightParsed = Number.parseInt(rawHeight, 10);

    const targetWidth =
      Number.isFinite(widthParsed) && widthParsed > 0 ? widthParsed : null;
    const targetHeight =
      Number.isFinite(heightParsed) && heightParsed > 0 ? heightParsed : null;

    const lockAspect =
      (lockAspectButton?.dataset.state ?? "on") === "on";

    return { targetWidth, targetHeight, lockAspect };
  };

  return {
    renderPreview,
    updateQualityLabel,
    clearMessages,
    setLoading,
    setStatus,
    showSuccess,
    showError,
    setZipReady,
    getSelectedFormat,
    getQualityValue,
    getResizeOptions,
  };
}

