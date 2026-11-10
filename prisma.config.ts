import { loadEnvFile } from "node:process";

import { defineConfig } from "prisma/config";

// A prisma.config.ts disables Prisma's own .env loading, so do it explicitly.
// Node's built-in loader keeps this dependency-free.
try {
  loadEnvFile(".env");
} catch {
  // No .env (e.g. CI, where variables are injected directly) — carry on.
}

// Replaces the deprecated `package.json#prisma` block (removed in Prisma 7).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
