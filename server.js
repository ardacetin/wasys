/**
 * Hostinger Node.js entry file.
 * hPanel → Application startup file / Entry file = server.js
 */
const { spawnSync } = require("node:child_process");
const {
  accessSync,
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
} = require("node:fs");
const { createServer } = require("node:http");
const { dirname, isAbsolute, resolve } = require("node:path");
const { parse } = require("node:url");

const projectRoot = __dirname;
const nodeDir = dirname(process.execPath);
process.env.PATH = `${nodeDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`;

// Hostinger writes env vars to nodejs/.env but does NOT always export them to
// the process. Load it here so this process AND every child we spawn see the
// exact same DATABASE_URL. dotenv never overrides already-exported vars.
try {
  require("dotenv").config({ path: resolve(projectRoot, ".env") });
} catch (error) {
  console.warn("[WASYS] Could not load .env", error);
}

/**
 * Normalize DATABASE_URL to an absolute, writable SQLite path IN THIS process,
 * so the spawned prisma CLI and the Next app all target the same file.
 * (prepare-db.mjs used to do this in a child process — the fix never
 * propagated back here, which is how `db push` and the app could drift apart.)
 */
function normalizeDatabaseUrl() {
  const configured = process.env.DATABASE_URL?.trim();
  if (!configured) {
    console.warn("[WASYS] DATABASE_URL is not set (check nodejs/.env)");
    return;
  }
  if (!configured.startsWith("file:")) {
    console.log(`[WASYS] DATABASE_URL provider: ${configured.split(":")[0]}`);
    return;
  }

  const raw = decodeURIComponent(configured.slice("file:".length).split("?")[0]);
  const configuredPath = raw.replace(/^\/\/\//, "/").replace(/^\/\/[^/]*/, "");
  const databasePath = isAbsolute(configuredPath)
    ? configuredPath
    : resolve(projectRoot, "prisma", configuredPath);

  const ensureWritable = (path) => {
    const directory = dirname(path);
    mkdirSync(directory, { recursive: true });
    accessSync(directory, constants.W_OK);
    try {
      accessSync(path, constants.R_OK | constants.W_OK);
    } catch {
      closeSync(openSync(path, "a"));
    }
  };

  try {
    ensureWritable(databasePath);
    process.env.DATABASE_URL = `file:${databasePath}`;
  } catch (error) {
    const fallbackPath = resolve(projectRoot, "data", "prod.db");
    console.error(
      `[WASYS] DATABASE_URL path not writable (${error.message}). Falling back to ${fallbackPath}`,
    );
    ensureWritable(fallbackPath);
    process.env.DATABASE_URL = `file:${fallbackPath}`;
  }

  // SQLite file paths are not secrets — log the resolved target so Hostinger
  // logs show exactly which file `db push` and the app use.
  console.log(`[WASYS] SQLite database: ${process.env.DATABASE_URL}`);
}

normalizeDatabaseUrl();

// Redeploy-safe persistent paths (outside nodejs/): SQLite + WhatsApp sessions.
// Overrides DATABASE_URL if it still points inside the deploy tree.
try {
  require("./prisma/persistent-paths.cjs").ensurePersistentDatabaseUrl();
} catch (error) {
  console.error("[WASYS] persistent path setup failed", error);
}

// WhatsApp QR (Baileys) — Hostinger bazen node_modules'ten düşürür; gateway
// import edilmeden önce zorunlu bağımlılığı doğrula / kur.
try {
  require("./scripts/ensure-baileys.cjs").ensureBaileysInstalled();
} catch (error) {
  console.error("[WASYS] Baileys doğrulama hatası", error);
}

function prismaCli() {
  const cli = resolve(projectRoot, "node_modules/prisma/build/index.js");
  if (!existsSync(cli)) {
    throw new Error(
      `Missing ${cli}. Wait for Hostinger build (npm install) to finish.`,
    );
  }
  return cli;
}

function runOptional(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    console.error(
      `[WASYS] ${label} failed (site will still start; in-process self-heal in src/lib/db.ts covers schema + admin). Check /api/health.`,
      result.error ?? `exit code ${result.status}`,
    );
  }
}

// Best effort: push schema + bootstrap admin via the CLI. If spawning fails on
// the shared host (memory/process limits), the app still starts — src/lib/db.ts
// applies prisma/init.sql in-process and creates the platform admin itself.
try {
  runOptional(process.execPath, [prismaCli(), "db", "push"], "prisma db push");
} catch (error) {
  console.error("[WASYS] prisma CLI unavailable", error.message);
}
runOptional(
  process.execPath,
  [resolve(projectRoot, "prisma/bootstrap.mjs")],
  "bootstrap",
);

const next = require("next");

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({
  dev: false,
  hostname,
  port,
  dir: projectRoot,
});
const handle = app.getRequestHandler();

app
  .prepare()
  .then(async () => {
    // WhatsApp QR gateway (Baileys) runs inside the same process. Next talks to
    // it in-process via globalThis.__wasysGateway (HTTP on :4001 is optional).
    try {
      const { startGateway } = await import("./gateway/server.mjs");
      const listening = await startGateway();
      console.log(
        `[WASYS] WhatsApp gateway ready (in-process${listening ? ` + http://127.0.0.1:${process.env.GATEWAY_PORT || 4001}` : " only"})`,
      );
    } catch (error) {
      console.error("[WASYS] WhatsApp gateway failed to start", error);
    }

    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, hostname, () => {
      console.log(`[WASYS] Ready on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error("[WASYS] Failed to start Next.js", error);
    process.exit(1);
  });
