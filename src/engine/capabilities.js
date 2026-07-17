import { mimeFromFormat } from "./converter.js";

/**
 * Probes which of `formats` this browser can genuinely encode.
 *
 * Browsers do not report an unsupported encoder: asked for one, they quietly
 * hand back PNG bytes instead (AVIF and GIF in both Chromium and Firefox). A
 * format therefore only counts as supported when the Blob that comes back
 * actually carries the MIME type that was requested.
 *
 * DOM-free: the probe surface comes from the injected `createCanvas` factory.
 */
export async function detectEncodableFormats(createCanvas, formats) {
  if (typeof createCanvas !== "function") {
    throw new Error("A createCanvas factory must be provided for detection.");
  }

  const candidates = Array.isArray(formats) ? formats : [];
  if (candidates.length === 0) {
    return [];
  }

  const canvas = createCanvas();
  canvas.width = 1;
  canvas.height = 1;

  // Without toBlob there is nothing to probe with. Rather than reporting every
  // format as broken and emptying the menu, defer to the conversion-time guard.
  if (typeof canvas.toBlob !== "function") {
    return [...candidates];
  }

  // A blank surface can encode differently from one holding pixels.
  canvas.getContext?.("2d")?.fillRect(0, 0, 1, 1);

  const supported = [];

  for (const format of candidates) {
    const mimeType = mimeFromFormat(format);

    try {
      const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, mimeType, 0.8);
      });

      if (blob && String(blob.type).toLowerCase() === mimeType.toLowerCase()) {
        supported.push(format);
      }
    } catch {
      // A throwing encoder means exactly what a substituted one does.
    }
  }

  // The probe surface is tiny, but releasing it keeps the contract uniform.
  canvas.width = 0;
  canvas.height = 0;

  return supported;
}
