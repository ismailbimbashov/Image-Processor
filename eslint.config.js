import js from "@eslint/js";
import globals from "globals";

/**
 * Flat config. The tree spans four environments — browser modules, the
 * pipeline Worker, Node test files, and build/test configuration — so each
 * gets only the globals it should legitimately have. Anything else is an
 * undefined variable rather than a silent runtime failure.
 */
export default [
  {
    ignores: ["dist/**", "dev-dist/**", "playwright-report/**", "test-results/**"],
  },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: globals.browser,
    },
    linterOptions: {
      // A disable comment for a rule that is not enabled is dead weight; six
      // of them accumulated in this repo before the linter existed.
      reportUnusedDisableDirectives: "error",
    },
    rules: {
      // The engine reports failures to its caller; only the UI layer may log.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // Sequential processing is a deliberate memory trade-off, so each await
      // inside a loop has to be signed for with an explicit disable comment.
      "no-await-in-loop": "error",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
    },
  },
  {
    // The Worker has no document and no window; it does have its own globals.
    files: ["src/engine/worker.js"],
    languageOptions: {
      globals: { ...globals.worker, ...globals.serviceworker },
    },
  },
  {
    files: ["tests/unit/**/*.js"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: globals.node,
    },
  },
  {
    files: [
      "tests/e2e/**/*.js",
      "tests/playwright.config.js",
      "vite.config.js",
      "eslint.config.js",
    ],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
