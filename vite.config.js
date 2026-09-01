import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// Strict production CSP. The built HTML references only first-party, hashed
// assets (no inline script/style, no CDN), so this needs neither
// 'unsafe-inline' nor 'unsafe-eval'. blob:/data: on img-src cover object-URL
// previews and the toDataURL fallback; worker-src blob: is for the pipeline
// Worker; manifest-src for the PWA manifest.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

// Injects the CSP <meta> into the built HTML only. The dev server serves inline
// HMR script/style, so a strict meta there would break `vite dev` — production
// is where the policy belongs (ideally also as an HTTP header at the edge).
const injectCsp = () => ({
  name: "inject-csp",
  apply: "build",
  transformIndexHtml(html) {
    const tag = `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`;
    return html.replace("</title>", `</title>\n    ${tag}`);
  },
});

// Relative base so the built site works when served from a sub-path
// (e.g. GitHub Pages project pages), not just the domain root.
export default defineConfig({
  base: "./",
  plugins: [
    injectCsp(),
    VitePWA({
      registerType: "autoUpdate",
      // Registration is done from bundled code (src/main.js via
      // virtual:pwa-register), NOT an injected inline <script>, so the strict
      // `script-src 'self'` CSP is preserved.
      injectRegister: false,
      includeAssets: ["favicon.png", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Glass Image Processor",
        short_name: "Image Processor",
        description:
          "Client-side batch image resizer & converter — everything runs locally in your browser.",
        theme_color: "#020617",
        background_color: "#020617",
        display: "standalone",
        start_url: "./",
        scope: "./",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        // Take control of open pages as soon as the SW activates, so the app
        // is offline-ready on first visit without a manual reload.
        clientsClaim: true,
        skipWaiting: true,
      },
    }),
  ],
  // Tailwind + Autoprefixer are configured inline here so the repo root stays
  // free of separate postcss.config.js / tailwind.config.js files.
  css: {
    postcss: {
      plugins: [
        tailwindcss({
          content: ["./index.html", "./src/**/*.js"],
          theme: { extend: {} },
          plugins: [],
        }),
        autoprefixer(),
      ],
    },
  },
  build: {
    target: "es2020",
    outDir: "dist",
    emptyOutDir: true,
  },
});
