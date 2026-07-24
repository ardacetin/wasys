/**
 * Hostinger Node.js entry file.
 * hPanel → Application startup file / Entry file = server.js
 */
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { createServer } = require("node:http");
const { dirname, resolve } = require("node:path");
const { parse } = require("node:url");
const next = require("next");

const projectRoot = __dirname;
const nodeDir = dirname(process.execPath);
process.env.PATH = `${nodeDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`;

function bin(name) {
  const local = resolve(projectRoot, "node_modules", ".bin", name);
  if (!existsSync(local)) {
    throw new Error(
      `Missing ${local}. Wait for Hostinger build (npm install) to finish.`,
    );
  }
  return local;
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

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runOptional(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error || result.status !== 0) {
    console.error(
      `[WASYS] ${label} failed (site will still start). Check /api/health for hints.`,
      result.error ?? `exit code ${result.status}`,
    );
  }
}

run(process.execPath, [resolve(projectRoot, "prisma/prepare-db.mjs")]);
run(process.execPath, [prismaCli(), "db", "push"]);
// Bootstrap creates/updates the platform admin from PLATFORM_ADMIN_EMAILS +
// PLATFORM_ADMIN_PASSWORD. A bad .env value must not take the whole site down.
runOptional(
  process.execPath,
  [resolve(projectRoot, "prisma/bootstrap.mjs")],
  "bootstrap",
);

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
    // WhatsApp QR gateway (Baileys) runs inside the same process so it works on
    // single-process hosts like Hostinger. Next talks to it over localhost:4001.
    try {
      const { startGateway } = await import("./gateway/server.mjs");
      await startGateway();
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
