/**
 * Pure helper: compute the target dimensions for a resize operation.
 *
 * Returns `null` when there is nothing to resize (no source pixels, or no
 * target dimensions requested), so callers can early-out. Otherwise returns
 * `{ width, height }` clamped to a minimum of 1px each.
 */
export function computeResizeDimensions(sourceWidth, sourceHeight, options = {}) {
  if (!sourceWidth || !sourceHeight) {
    return null;
  }

  const { targetWidth, targetHeight, lockAspect } = options;

  let width = Number.isFinite(targetWidth) && targetWidth > 0 ? targetWidth : null;
  let height = Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight : null;

  if (!width && !height) {
    // Nothing to resize; keep original dimensions.
    return null;
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

  return {
    width: Math.max(1, Math.round(width || sourceWidth)),
    height: Math.max(1, Math.round(height || sourceHeight)),
  };
}

/**
 * Resizes `canvas` in place. The offscreen surface is obtained from the
 * injected `createCanvas` factory so this module never reaches for `document`.
 */
export function applyResize(canvas, ctx, options = {}, createCanvas) {
  if (!canvas || !ctx) {
    throw new Error("Canvas context is not available for resizing.");
  }

  if (typeof createCanvas !== "function") {
    throw new Error("A createCanvas factory must be provided for resizing.");
  }

  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;

  const dimensions = computeResizeDimensions(sourceWidth, sourceHeight, options);
  if (!dimensions) {
    return;
  }

  const { width, height } = dimensions;

  // Draw from an offscreen canvas to preserve source pixels.
  const offscreen = createCanvas();
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

  // The scratch surface can hold a full-resolution backing store; drop it now
  // rather than waiting for the collector to notice.
  offscreen.width = 0;
  offscreen.height = 0;
}

