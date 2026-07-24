import { PrismaClient } from "@prisma/client";
import { spawnSync } from "node:child_process";
import {
  accessSync,
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  __wasysSqliteReady?: boolean;
  __wasysSchemaReady?: boolean;
};

/**
 * Hostinger often sets DATABASE_URL to a path outside nodejs/ that is not writable
 * (SQLite Error 14). Normalize to a writable file URL before Prisma connects.
 */
function ensureSqliteDatabaseUrl() {
  if (globalForPrisma.__wasysSqliteReady) return;
  globalForPrisma.__wasysSqliteReady = true;

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

/**
 * Empty SQLite files (0 bytes) happen when the path is created but `db push` never ran.
 * Hostinger entry may not be server.js — push schema on first runtime import.
 */
function ensureSchemaAndBootstrap() {
  if (globalForPrisma.__wasysSchemaReady) return;
  globalForPrisma.__wasysSchemaReady = true;

  if (process.env.WASYS_SKIP_DB_PUSH === "1") return;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl?.startsWith("file:")) return;

  const raw = decodeURIComponent(databaseUrl.slice("file:".length).split("?")[0]);
  const databasePath = raw.replace(/^\/\/\//, "/").replace(/^\/\/[^/]*/, "");
  const fileBytes = existsSync(databasePath) ? statSync(databasePath).size : 0;

  const nodeDir = dirname(process.execPath);
  const env = {
    ...process.env,
    PATH: `${nodeDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`,
  };

  const prismaCli = resolve(process.cwd(), "node_modules/prisma/build/index.js");
  const applyInitSql = resolve(process.cwd(), "prisma/apply-init-sql.mjs");

  console.log(`[WASYS DB] Ensuring schema (fileBytes=${fileBytes})`);

  let schemaApplied = false;

  if (existsSync(prismaCli)) {
    const push = spawnSync(
      process.execPath,
      [prismaCli, "db", "push", "--skip-generate"],
      { cwd: process.cwd(), env, encoding: "utf8" },
    );
    if (push.status === 0) {
      schemaApplied = true;
    } else {
      console.error(
        "[WASYS DB] prisma db push failed",
        (push.stderr || push.stdout || "").slice(0, 1000),
      );
    }
  } else {
    console.warn("[WASYS DB] prisma CLI missing (devDependency pruned?)");
  }

  if (!schemaApplied && existsSync(applyInitSql)) {
    // No CLI on the server: create tables straight from the bundled init.sql.
    const apply = spawnSync(process.execPath, [applyInitSql], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
    });
    if (apply.status === 0) {
      schemaApplied = true;
      console.log((apply.stdout || "").trim());
    } else {
      console.error(
        "[WASYS DB] apply-init-sql failed",
        (apply.stderr || apply.stdout || "").slice(0, 1000),
      );
    }
  }

  if (!schemaApplied) {
    console.error("[WASYS DB] could not create tables");
    return;
  }

  const bootstrap = resolve(process.cwd(), "prisma/bootstrap.mjs");
  if (!existsSync(bootstrap)) return;

  const boot = spawnSync(process.execPath, [bootstrap], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });

  if (boot.status !== 0) {
    console.error(
      "[WASYS DB] bootstrap failed",
      (boot.stderr || boot.stdout || "").slice(0, 1000),
    );
  } else {
    console.log("[WASYS DB] schema + bootstrap ready");
  }
}

ensureSqliteDatabaseUrl();
ensureSchemaAndBootstrap();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
