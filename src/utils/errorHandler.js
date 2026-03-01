export class ErrorHandler {
  constructor(renderer) {
    this.renderer = renderer;
  }

  clear() {
    this.renderer?.clearMessages();
  }

  noFilesSelected() {
    this.renderer?.showError(
      "Please select at least one image before converting.",
    );
  }

  invalidFilesSelected() {
    this.renderer?.showError("Please choose at least one valid image file.");
  }

  dropInvalidFiles() {
    this.renderer?.showError("Please drop at least one valid image file.");
  }

  jsZipUnavailable(error) {
    // eslint-disable-next-line no-console
    console.error(error);
    this.renderer?.showError(
      "The ZIP library could not be loaded. Please check your network connection and try again.",
    );
  }

  allConversionsFailed() {
    this.renderer?.showError("Conversion failed for all selected images.");
  }

  genericConversionError(error) {
    // eslint-disable-next-line no-console
    console.error(error);
    const message =
      error && typeof error.message === "string"
        ? error.message
        : "An unexpected error occurred during conversion.";
    this.renderer?.showError(message);
  }

  zipGenerationError(error) {
    // eslint-disable-next-line no-console
    console.error(error);
    this.renderer?.showError("Failed to generate ZIP file.");
  }

  noZipReady() {
    this.renderer?.showError(
      "No converted images found. Please convert images before downloading the ZIP.",
    );
  }
}

