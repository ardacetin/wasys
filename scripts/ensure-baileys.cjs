/**
 * Hostinger Redeploy bazen node_modules'ü eksik bırakır veya Next izleme
 * Baileys'i budar. Gateway import'tan önce paketin varlığını doğrula;
 * yoksa npm ile yüklemeyi dene.
 */
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { dirname, resolve } = require("node:path");

const BAILEYS_SPEC = "@whiskeysockets/baileys@6.7.22";
const projectRoot = resolve(__dirname, "..");
const marker = resolve(
  projectRoot,
  "node_modules/@whiskeysockets/baileys/package.json",
);

function withNodeOnPath(env = process.env) {
  const nodeDir = dirname(process.execPath);
  return {
    ...env,
    PATH: `${nodeDir}${env.PATH ? `:${env.PATH}` : ""}`,
  };
}

function resolveNpm() {
  const nodeDir = dirname(process.execPath);
  const npmJs = resolve(nodeDir, "npm");
  if (existsSync(npmJs)) return { command: npmJs, prefixArgs: [] };

  // alt-nodejs layouts: .../bin/node + .../lib/node_modules/npm/bin/npm-cli.js
  const candidates = [
    resolve(nodeDir, "../lib/node_modules/npm/bin/npm-cli.js"),
    resolve(nodeDir, "node_modules/npm/bin/npm-cli.js"),
    "/opt/alt/alt-nodejs22/root/usr/lib/node_modules/npm/bin/npm-cli.js",
    "/opt/alt/alt-nodejs20/root/usr/lib/node_modules/npm/bin/npm-cli.js",
    "/opt/alt/alt-nodejs18/root/usr/lib/node_modules/npm/bin/npm-cli.js",
  ];
  for (const cli of candidates) {
    if (existsSync(cli)) {
      return { command: process.execPath, prefixArgs: [cli] };
    }
  }
  return { command: "npm", prefixArgs: [] };
}

function isInstalled() {
  return existsSync(marker);
}

function ensureBaileysInstalled() {
  if (isInstalled()) {
    try {
      const version = require(marker).version;
      console.log(`[WASYS] Baileys hazır (v${version})`);
    } catch {
      console.log("[WASYS] Baileys hazır");
    }
    return true;
  }

  console.warn(
    `[WASYS] ${BAILEYS_SPEC} eksik — kurulum deneniyor (Hostinger node_modules budaması / yarım install)`,
  );

  const npm = resolveNpm();
  const args = [
    ...npm.prefixArgs,
    "install",
    BAILEYS_SPEC,
    "--no-audit",
    "--no-fund",
    "--omit=dev",
    "--legacy-peer-deps",
  ];

  const result = spawnSync(npm.command, args, {
    cwd: projectRoot,
    env: withNodeOnPath(),
    stdio: "inherit",
  });

  if (result.error) {
    console.error("[WASYS] Baileys npm install başlatılamadı:", result.error.message);
  } else if (result.status !== 0) {
    console.error(`[WASYS] Baileys npm install exit ${result.status}`);
  }

  if (!isInstalled()) {
    console.error(
      "[WASYS] Baileys hâlâ yok. hPanel → Redeploy (Entry file=server.js) ve npm install loglarını kontrol edin.",
    );
    return false;
  }

  console.log("[WASYS] Baileys kuruldu");
  return true;
}

if (require.main === module) {
  process.exit(ensureBaileysInstalled() ? 0 : 1);
}

module.exports = { ensureBaileysInstalled, isInstalled };
