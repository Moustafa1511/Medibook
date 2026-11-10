import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Base config. The two suites (node for tests/unit, jsdom for tests/component)
 * are defined in vitest.workspace.ts and inherit this file's alias + plugins.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    passWithNoTests: true,
  },
});
