const ensureJsZip = () => {
  if (typeof JSZip === "undefined") {
    throw new Error("JSZip library failed to load.");
  }
  return JSZip;
};

export const getTargetExtension = (format) =>
  format === "jpg" ? "jpg" : String(format || "png").toLowerCase();

const sanitizeBaseName = (name) => {
  if (!name) return "image";
  // Strip any path components first.
  const justName = name.split(/[\\/]/).pop() || name;
  const withoutExt = justName.replace(/\.[^/.]+$/, "");
  // Replace characters that are problematic in filenames.
  return withoutExt.replace(/[^a-zA-Z0-9._-]+/g, "_") || "image";
};

export const buildTargetFileName = (originalName, targetExt) => {
  const baseName = sanitizeBaseName(originalName);
  return `${baseName}.${targetExt}`;
};

export const createZip = () => {
  const JsZipCtor = ensureJsZip();
  return new JsZipCtor();
};

export const addBlobToZip = (zip, fileName, blob) => {
  if (!zip) {
    throw new Error("ZIP instance is not available.");
  }
  zip.file(fileName, blob);
};

export const generateZipBlob = async (zip) => {
  if (!zip) {
    throw new Error("ZIP instance is not available.");
  }
  return zip.generateAsync({ type: "blob" });
};

