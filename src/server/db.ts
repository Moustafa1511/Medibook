import { PrismaClient } from "@prisma/client";

import { env, isProduction } from "@/lib/env";

/**
 * Prisma Client singleton. Cached on globalThis so a dev HMR reload reuses the
 * existing client instead of opening a new connection pool on every edit, which
 * otherwise exhausts Postgres connections within a handful of saves.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const verbose = env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "trace";
  return new PrismaClient({
    log: verbose ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

export const db: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = db;
}
