import "dotenv/config";
import { accessSync, constants, mkdirSync, openSync, closeSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const schemaDirectory = dirname(fileURLToPath(new URL("./schema.prisma", import.meta.url)));

function toFileUrl(absolutePath) {
  return `file:${absolutePath}`;
}

function resolveSqlitePath(databaseUrl) {
  const raw = decodeURIComponent(databaseUrl.slice("file:".length).split("?")[0]);
  // file:///abs → /abs ; file:/abs → /abs ; file:./rel → ./rel
  const configuredPath = raw.replace(/^\/\/\//, "/").replace(/^\/\/[^/]*/, "");

  return isAbsolute(configuredPath)
    ? configuredPath
    : resolve(schemaDirectory, configuredPath);
}

function ensureWritableSqliteFile(databasePath) {
  const directory = dirname(databasePath);
  mkdirSync(directory, { recursive: true });
  accessSync(directory, constants.W_OK);

  try {
    accessSync(databasePath, constants.R_OK | constants.W_OK);
  } catch {
    const fd = openSync(databasePath, "a");
    closeSync(fd);
  }
}

function prepareCandidate(databaseUrl) {
  if (!databaseUrl.startsWith("file:")) {
    process.env.DATABASE_URL = databaseUrl;
    console.log(`Non-SQLite DATABASE_URL detected (${databaseUrl.split(":")[0]})`);
    return databaseUrl;
  }

  const databasePath = resolveSqlitePath(databaseUrl);
  ensureWritableSqliteFile(databasePath);
  const normalized = toFileUrl(databasePath);
  process.env.DATABASE_URL = normalized;
  console.log(`SQLite ready at ${databasePath}`);
  return normalized;
}

const configuredUrl = process.env.DATABASE_URL?.trim();

if (!configuredUrl) {
  throw new Error("DATABASE_URL is not set");
}

const fallbackUrl = toFileUrl(resolve(projectRoot, "data", "prod.db"));

try {
  prepareCandidate(configuredUrl);
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`[WASYS] Cannot use DATABASE_URL=${configuredUrl}`);
  console.error(`[WASYS] Reason: ${reason}`);

  if (configuredUrl === fallbackUrl || !configuredUrl.startsWith("file:")) {
    throw error;
  }

  console.warn(`[WASYS] Falling back to writable app path: ${fallbackUrl}`);
  prepareCandidate(fallbackUrl);
}
