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

// WhatsApp QR (Baileys) — Hostinger bazen node_modules'ten düşürür.
// scripts/ensure-baileys.cjs yoksa (eski deploy) burada inline dene.
function ensureBaileysInline() {
  const marker = resolve(
    projectRoot,
    "node_modules/@whiskeysockets/baileys/package.json",
  );
  if (existsSync(marker)) {
    console.log("[WASYS] Baileys hazır");
    return true;
  }
  console.warn("[WASYS] Baileys eksik — npm install deneniyor…");
  const npmCliCandidates = [
    resolve(nodeDir, "npm"),
    resolve(nodeDir, "../lib/node_modules/npm/bin/npm-cli.js"),
    "/opt/alt/alt-nodejs22/root/usr/lib/node_modules/npm/bin/npm-cli.js",
  ];
  let command = "npm";
  let args = [
    "install",
    "@whiskeysockets/baileys@6.7.22",
    "--omit=dev",
    "--legacy-peer-deps",
    "--no-audit",
    "--no-fund",
  ];
  for (const candidate of npmCliCandidates) {
    if (!existsSync(candidate)) continue;
    if (candidate.endsWith("npm-cli.js")) {
      command = process.execPath;
      args = [candidate, ...args];
    } else {
      command = candidate;
    }
    break;
  }
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (existsSync(marker)) {
    console.log("[WASYS] Baileys kuruldu");
    return true;
  }
  console.error(
    "[WASYS] Baileys kurulamadı",
    result.error?.message ?? `exit ${result.status}`,
  );
  return false;
}

try {
  if (existsSync(resolve(projectRoot, "scripts/ensure-baileys.cjs"))) {
    require("./scripts/ensure-baileys.cjs").ensureBaileysInstalled();
  } else {
    ensureBaileysInline();
  }
} catch (error) {
  console.error("[WASYS] Baileys doğrulama hatası", error);
  ensureBaileysInline();
}

// Vendor kopyası ensureBaileysInstalled içinde (bütünlük OK ise) yapılır.

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
  .then(() => {
    // Önce HTTP — Baileys/gateway boot'u siteyi asla bekletmesin (Hostinger timeout).
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, hostname, () => {
      console.log(`[WASYS] Ready on http://${hostname}:${port}`);

      void (async () => {
        try {
          const { pathToFileURL } = require("node:url");
          const { statSync } = require("node:fs");
          const runtimePath = resolve(projectRoot, "gateway/wa-runtime.mjs");
          if (!existsSync(runtimePath)) {
            throw new Error(
              `gateway/wa-runtime.mjs yok (${runtimePath}). Son main commit'i Redeploy edin.`,
            );
          }
          const bust = statSync(runtimePath).mtimeMs;
          const { startGateway, GATEWAY_LOADER_ID } = await import(
            `${pathToFileURL(runtimePath).href}?t=${bust}`
          );
          const listening = globalThis.__wasysGateway
            ? Boolean(globalThis.__wasysGatewayHttpListening)
            : await startGateway();
          console.log(
            `[WASYS] WhatsApp gateway ready loader=${GATEWAY_LOADER_ID || "?"} (in-process${listening ? ` + http://127.0.0.1:${process.env.GATEWAY_PORT || 4001}` : " only"})`,
          );

          // gateway-webhook köprüsünü yükle (mesajların in-process işlenmesi)
          try {
            const secret =
              process.env.GATEWAY_SECRET || "wasys-gateway-secret";
            const ping = await fetch(
              `http://127.0.0.1:${port}/api/webhooks/wa-gateway`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "x-gateway-secret": secret,
                },
                body: JSON.stringify({ event: "ping" }),
              },
            );
            console.log(
              `[WASYS] gateway webhook bridge ping HTTP ${ping.status}`,
            );
          } catch (bridgeErr) {
            console.warn(
              "[WASYS] gateway webhook bridge ping failed",
              bridgeErr,
            );
          }
        } catch (error) {
          console.error("[WASYS] WhatsApp gateway failed to start", error);
        }
      })();
    });
  })
  .catch((error) => {
    console.error("[WASYS] Failed to start Next.js", error);
    process.exit(1);
  });
