/**
 * Kalıcı veri dizini (Hostinger Redeploy-safe) — CommonJS, server.js require eder.
 *
 * Hostinger Redeploy `nodejs/` içeriğini siler. SQLite + WhatsApp oturumları
 * deploy dışındaki /home/u781807728/wasys-data/ altında tutulur.
 */
const {
  accessSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  statSync,
} = require("node:fs");
const { dirname, isAbsolute, join, resolve } = require("node:path");

const projectRoot = resolve(__dirname, "..");

function homePersistentRoot() {
  return "/home/u781807728/wasys-data";
}

function resolveDataRoot() {
  if (process.env.WASYS_DATA_DIR && process.env.WASYS_DATA_DIR.trim()) {
    return resolve(process.env.WASYS_DATA_DIR.trim());
  }

  const homeRoot = homePersistentRoot();
  if (existsSync("/home/u781807728") || process.env.NODE_ENV === "production") {
    try {
      mkdirSync(homeRoot, { recursive: true });
      accessSync(homeRoot, constants.W_OK);
      return homeRoot;
    } catch {
      // fall through
    }
  }

  const local = resolve(projectRoot, "data");
  mkdirSync(local, { recursive: true });
  return local;
}

function ensureWritableDirForFile(filePath) {
  const directory = dirname(filePath);
  mkdirSync(directory, { recursive: true });
  accessSync(directory, constants.W_OK);
}

function migrateLegacyDatabase(targetDbPath) {
  if (existsSync(targetDbPath) && statSync(targetDbPath).size > 0) return;

  const legacyCandidates = [
    resolve(projectRoot, "data", "prod.db"),
    resolve(projectRoot, "prisma", "prod.db"),
    "/home/u781807728/domains/wasys.pro/nodejs/data/prod.db",
    "/home/u781807728/domains/wasys.pro/data/prod.db",
  ];

  for (const legacy of legacyCandidates) {
    try {
      if (!existsSync(legacy)) continue;
      if (statSync(legacy).size === 0) continue;
      if (resolve(legacy) === resolve(targetDbPath)) continue;
      ensureWritableDirForFile(targetDbPath);
      copyFileSync(legacy, targetDbPath);
      for (const suffix of ["-wal", "-shm"]) {
        const side = `${legacy}${suffix}`;
        if (existsSync(side)) copyFileSync(side, `${targetDbPath}${suffix}`);
      }
      console.log(`[WASYS] Migrated legacy database ${legacy} → ${targetDbPath}`);
      return;
    } catch (error) {
      console.warn(`[WASYS] Could not migrate ${legacy}`, error);
    }
  }
}

function isInsideDeployTree(databasePath) {
  // Only Hostinger app directory is wiped on Redeploy — not local ./data
  return resolve(databasePath).includes("/nodejs/");
}

function ensurePersistentDatabaseUrl() {
  const dataRoot = resolveDataRoot();
  process.env.WASYS_DATA_DIR = dataRoot;
  if (!process.env.GATEWAY_DATA_DIR) {
    process.env.GATEWAY_DATA_DIR = dataRoot;
  }

  const preferredDb = join(dataRoot, "prod.db");
  migrateLegacyDatabase(preferredDb);

  const configured = process.env.DATABASE_URL ? process.env.DATABASE_URL.trim() : "";

  if (configured && !configured.startsWith("file:")) {
    console.log(`[WASYS] Non-SQLite DATABASE_URL (${configured.split(":")[0]})`);
    return configured;
  }

  let databasePath = preferredDb;

  if (configured.startsWith("file:")) {
    try {
      const raw = decodeURIComponent(configured.slice("file:".length).split("?")[0]);
      const configuredPath = raw.replace(/^\/\/\//, "/").replace(/^\/\/[^/]*/, "");
      const absolute = isAbsolute(configuredPath)
        ? configuredPath
        : resolve(projectRoot, "prisma", configuredPath);

      if (isInsideDeployTree(absolute)) {
        console.warn(
          `[WASYS] DATABASE_URL deploy klasöründe (${absolute}). Redeploy silmesin diye: ${preferredDb}`,
        );
        databasePath = preferredDb;
      } else {
        ensureWritableDirForFile(absolute);
        databasePath = absolute;
      }
    } catch (error) {
      console.warn(
        `[WASYS] Configured DATABASE_URL not usable (${error.message}); using ${preferredDb}`,
      );
      databasePath = preferredDb;
    }
  }

  ensureWritableDirForFile(databasePath);
  const normalized = `file:${databasePath}`;
  process.env.DATABASE_URL = normalized;

  // WhatsApp oturum klasörünü de kalıcı köke taşı (bir kez)
  const legacyAuth = resolve(projectRoot, "data", "gateway-auth");
  const targetAuth = join(dataRoot, "gateway-auth");
  try {
    if (existsSync(legacyAuth) && !existsSync(targetAuth)) {
      const { cpSync } = require("node:fs");
      cpSync(legacyAuth, targetAuth, { recursive: true });
      console.log(`[WASYS] Migrated gateway-auth → ${targetAuth}`);
    }
  } catch (error) {
    console.warn("[WASYS] gateway-auth migrate skipped", error);
  }

  console.log(`[WASYS] Persistent SQLite: ${normalized}`);
  console.log(`[WASYS] Persistent data dir: ${dataRoot}`);
  return normalized;
}

module.exports = {
  resolveDataRoot,
  ensurePersistentDatabaseUrl,
  migrateLegacyDatabase,
  projectRoot,
};
