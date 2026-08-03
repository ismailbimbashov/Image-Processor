import JSZip from "jszip";

export const getTargetExtension = (format) =>
  format === "jpg" ? "jpg" : String(format || "png").toLowerCase();

export const sanitizeBaseName = (name) => {
  if (!name) return "image";
  // Strip any path components first.
  const justName = name.split(/[\\/]/).pop() || name;
  const withoutExt = justName.replace(/\.[^/.]+$/, "");
  // Replace characters that are problematic in filenames.
  return withoutExt.replace(/[^a-zA-Z0-9._-]+/g, "_") || "image";
};

// An extension never legitimately contains a separator or a dot, so unsafe
// characters are dropped rather than substituted: a placeholder would let
// "./.." survive as "_.._" and still describe a directory hop.
export const sanitizeExtension = (ext) => {
  const justExt = String(ext ?? "").split(/[\\/]/).pop() || "";
  return justExt.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase() || "png";
};

// Derives the extension the output blob should carry. It lives here, beside
// the sanitiser, so no caller can assemble a name that bypasses it.
export const resolveTargetExtension = (originalName, format, changeFormat) => {
  if (changeFormat) {
    return sanitizeExtension(getTargetExtension(format));
  }

  const name = String(originalName ?? "");
  // Without a dot there is no extension to preserve; sanitizeExtension then
  // supplies the "png" fallback instead of treating the whole name as one.
  const originalExt = name.includes(".") ? name.split(".").pop() : "";
  return sanitizeExtension(originalExt);
};

export const buildTargetFileName = (originalName, targetExt) => {
  const baseName = sanitizeBaseName(originalName);
  return `${baseName}.${sanitizeExtension(targetExt)}`;
};

/**
 * Returns a ZIP entry name that does not collide with any already recorded in
 * `usedNames`, appending an incrementing counter before the extension when it
 * would. Distinct source files that sanitise to the same name (e.g. two
 * `photo.png` files from different folders) would otherwise silently overwrite
 * one another in the archive. Mutates `usedNames` with the returned name.
 */
export const uniqueEntryName = (name, usedNames = new Set()) => {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const dot = name.lastIndexOf(".");
  const base = dot === -1 ? name : name.slice(0, dot);
  const ext = dot === -1 ? "" : name.slice(dot);

  let counter = 2;
  let candidate = `${base}-${counter}${ext}`;
  while (usedNames.has(candidate)) {
    counter += 1;
    candidate = `${base}-${counter}${ext}`;
  }

  usedNames.add(candidate);
  return candidate;
};

export const createZip = () => {
  return new JSZip();
};

export const addBlobToZip = (zip, fileName, blob) => {
  if (!zip) {
    throw new Error("ZIP instance is not available.");
  }
  // Last line of defence: a separator here means a sanitiser was bypassed.
  if (/[\\/]/.test(fileName)) {
    throw new Error(`Refusing to add an unsafe ZIP entry name: ${fileName}`);
  }
  zip.file(fileName, blob);
};

export const generateZipBlob = async (zip) => {
  if (!zip) {
    throw new Error("ZIP instance is not available.");
  }
  return zip.generateAsync({ type: "blob" });
};
