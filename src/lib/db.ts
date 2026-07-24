import { PrismaClient } from "@prisma/client";
import { accessSync, closeSync, constants, mkdirSync, openSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

/**
 * Hostinger often sets DATABASE_URL to a path outside nodejs/ that is not writable
 * (SQLite Error 14). Normalize to a writable file URL before Prisma connects.
 */
function ensureSqliteDatabaseUrl() {
  const configured = process.env.DATABASE_URL?.trim();
  if (!configured?.startsWith("file:")) return;

  const resolveSqlitePath = (databaseUrl: string) => {
    const raw = decodeURIComponent(
      databaseUrl.slice("file:".length).split("?")[0],
    );
    const configuredPath = raw
      .replace(/^\/\/\//, "/")
      .replace(/^\/\/[^/]*/, "");

    if (isAbsolute(configuredPath)) return configuredPath;
    // Prisma resolves relative SQLite paths against the schema directory.
    return resolve(process.cwd(), "prisma", configuredPath);
  };

  const ensureWritable = (databasePath: string) => {
    const directory = dirname(databasePath);
    mkdirSync(directory, { recursive: true });
    accessSync(directory, constants.W_OK);
    try {
      accessSync(databasePath, constants.R_OK | constants.W_OK);
    } catch {
      const fd = openSync(databasePath, "a");
      closeSync(fd);
    }
  };

  const fallbackPath = resolve(process.cwd(), "data", "prod.db");

  try {
    const databasePath = resolveSqlitePath(configured);
    ensureWritable(databasePath);
    process.env.DATABASE_URL = `file:${databasePath}`;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      `[WASYS DB] Cannot use DATABASE_URL=${configured} (${reason}). Falling back to ${fallbackPath}`,
    );
    ensureWritable(fallbackPath);
    process.env.DATABASE_URL = `file:${fallbackPath}`;
  }
}

ensureSqliteDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
