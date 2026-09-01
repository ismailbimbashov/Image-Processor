import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// The app is a static site served over HTTP (ES modules can't load over file://).
// Playwright starts the server for you; override the port/URL via env vars.
const PORT = process.env.PORT || 8000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}/`;
// This config lives in tests/, but build/preview must run from the repo root.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: APP_URL,
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // E2E runs against the real production build (Vite build → preview), so the
  // strict CSP, bundled Tailwind/JSZip, and hashed assets are all exercised.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    cwd: ROOT,
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
