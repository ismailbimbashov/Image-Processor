import { defineConfig, devices } from "@playwright/test";

// The app is a static site served over HTTP (ES modules can't load over file://).
// Playwright starts the server for you; override the port/URL via env vars.
const PORT = process.env.PORT || 8000;
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}/`;

export default defineConfig({
  testDir: "./tests/e2e",
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
  webServer: {
    command: `python3 -m http.server ${PORT}`,
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
