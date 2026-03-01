export function applyResize(canvas, ctx, options = {}) {
  if (!canvas || !ctx) {
    throw new Error("Canvas context is not available for resizing.");
  }

  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;

  if (!sourceWidth || !sourceHeight) {
    return;
  }

  const { targetWidth, targetHeight, lockAspect } = options;

  let width = Number.isFinite(targetWidth) ? targetWidth : null;
  let height = Number.isFinite(targetHeight) ? targetHeight : null;

  if (!width && !height) {
    // Nothing to resize; keep original dimensions.
    return;
  }

  const aspect = sourceWidth / sourceHeight;

  if (lockAspect) {
    if (width && !height) {
      height = Math.round(width / aspect);
    } else if (!width && height) {
      width = Math.round(height * aspect);
    } else if (width && height) {
      // Both provided; choose the one that best preserves aspect ratio.
      const widthFromHeight = Math.round(height * aspect);
      const heightFromWidth = Math.round(width / aspect);
      if (Math.abs(widthFromHeight - width) < Math.abs(heightFromWidth - height)) {
        width = widthFromHeight;
      } else {
        height = heightFromWidth;
      }
    }
  } else {
    // If only one dimension is provided without aspect lock, keep the other.
    if (!width) width = sourceWidth;
    if (!height) height = sourceHeight;
  }

  width = Math.max(1, Math.round(width || sourceWidth));
  height = Math.max(1, Math.round(height || sourceHeight));

  // Draw from an offscreen canvas to preserve source pixels.
  const offscreen = document.createElement("canvas");
  offscreen.width = sourceWidth;
  offscreen.height = sourceHeight;
  const offCtx = offscreen.getContext("2d");

  if (!offCtx) {
    throw new Error("Unable to acquire offscreen canvas context for resizing.");
  }

  offCtx.drawImage(canvas, 0, 0);

  canvas.width = width;
  canvas.height = height;

  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(offscreen, 0, 0, width, height);
}

