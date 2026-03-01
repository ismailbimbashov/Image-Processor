## Image Converter App

This is a simple, responsive image converter built with **HTML5**, **Tailwind CSS** (via CDN), and **vanilla JavaScript**.

- **Upload**: Drag-and-drop or click to select a single image file (JPG, PNG, WEBP, GIF, or any image MIME type supported by your browser).
- **Preview**: The selected image is displayed before conversion.
- **Convert**: The app uses a hidden `<canvas>` element to draw the image and converts it to the selected format (JPG, PNG, WEBP, or GIF) via `canvas.toBlob()` / `canvas.toDataURL()`.
- **Download**: The converted file is automatically downloaded as `converted-image.&lt;ext&gt;`.
- **Feedback**: A spinner is shown during conversion and a success message appears when the download starts. Error messages are displayed if something goes wrong.

> Note: Browser support for some output formats (especially WEBP and GIF from canvas) can vary. When a format is not fully supported, the app falls back to the closest format the browser provides and notifies you.

