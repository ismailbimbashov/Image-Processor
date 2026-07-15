export const mimeFromFormat = (format, originalType) => {
  const normalized = String(format || "").toLowerCase();

  switch (normalized) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "avif":
      return "image/avif";
    case "gif":
      return "image/gif";
    case "original":
      return originalType || "image/png";
    default:
      return "image/png";
  }
};

/**
 * Pure canvas conversion helper. Does not read files or mutate the canvas.
 * It only serializes the current canvas contents into a Blob.
 */
export function convertCanvasToBlob(
  canvas,
  { format = "png", quality = 0.8, originalType } = {},
) {
  if (!canvas) {
    return Promise.reject(
      new Error("Canvas is not available for conversion."),
    );
  }

  const mimeType = mimeFromFormat(format, originalType);
  const clampedQuality = Math.min(1, Math.max(0, quality));

  return new Promise((resolve, reject) => {
    const handleBlob = (blob) => {
      if (!blob) {
        reject(
          new Error(
            "Conversion failed. Your browser may not support this format.",
          ),
        );
        return;
      }
      resolve(blob);
    };

    if (canvas.toBlob) {
      canvas.toBlob(handleBlob, mimeType, clampedQuality);
      return;
    }

    try {
      const outDataUrl = canvas.toDataURL(mimeType, clampedQuality);
      const [meta, data] = outDataUrl.split(",");
      const byteString = atob(data);
      const mimeString = meta.split(":")[1].split(";")[0];
      const buffer = new ArrayBuffer(byteString.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < byteString.length; i += 1) {
        view[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([buffer], { type: mimeString });
      handleBlob(blob);
    } catch (error) {
      reject(
        new Error(
          "Conversion is not supported in this browser for the selected format.",
        ),
      );
    }
  });
}

