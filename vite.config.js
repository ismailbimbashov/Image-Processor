import { defineConfig } from "vite";
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
  plugins: [injectCsp()],
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
