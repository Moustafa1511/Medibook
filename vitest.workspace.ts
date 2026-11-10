import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    extends: "./vitest.config.ts",
    test: {
      name: "unit",
      environment: "node",
      include: ["tests/unit/**/*.test.ts"],
      setupFiles: ["./tests/setup/test-env.ts"],
    },
  },
  {
    extends: "./vitest.config.ts",
    test: {
      name: "component",
      environment: "jsdom",
      include: ["tests/component/**/*.test.tsx"],
      setupFiles: ["./tests/setup/test-env.ts", "./tests/setup/component.ts"],
    },
  },
]);
