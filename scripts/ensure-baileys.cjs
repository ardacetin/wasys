/**
 * Hostinger Redeploy bazen node_modules'ü eksik bırakır veya Next izleme
 * Baileys'i budar. Gateway import'tan önce paketin varlığını doğrula;
 * yoksa npm ile yüklemeyi dene. Ayrıca gateway/vendor/baileys'e kopyala
 * (bare package import'a hiç ihtiyaç kalmasın).
 */
const { spawnSync } = require("node:child_process");
const {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
} = require("node:fs");
const { dirname, resolve } = require("node:path");

const BAILEYS_SPEC = "@whiskeysockets/baileys@6.7.22";
const projectRoot = resolve(__dirname, "..");
const nmPackage = resolve(
  projectRoot,
  "node_modules/@whiskeysockets/baileys",
);
const nmMarker = resolve(nmPackage, "package.json");
const nmEntry = resolve(nmPackage, "lib/index.js");
const vendorDir = resolve(projectRoot, "gateway/vendor/baileys");
const vendorMarker = resolve(vendorDir, "package.json");
const vendorEntry = resolve(vendorDir, "lib/index.js");

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
  return existsSync(nmMarker) && existsSync(nmEntry);
}

function syncVendorCopy() {
  if (!isInstalled()) return false;
  try {
    mkdirSync(resolve(projectRoot, "gateway/vendor"), { recursive: true });
    rmSync(vendorDir, { recursive: true, force: true });
    cpSync(nmPackage, vendorDir, { recursive: true, force: true });
    if (existsSync(vendorEntry)) {
      const version = require(vendorMarker).version;
      console.log(`[WASYS] Baileys vendor kopyası hazır (v${version}) → ${vendorDir}`);
      return true;
    }
  } catch (error) {
    console.error(
      "[WASYS] Baileys vendor kopyası başarısız:",
      error instanceof Error ? error.message : error,
    );
  }
  return false;
}

function ensureBaileysInstalled() {
  if (isInstalled()) {
    try {
      const version = require(nmMarker).version;
      console.log(`[WASYS] Baileys hazır (v${version})`);
    } catch {
      console.log("[WASYS] Baileys hazır");
    }
    syncVendorCopy();
    return existsSync(vendorEntry) || isInstalled();
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
  syncVendorCopy();
  return true;
}

if (require.main === module) {
  process.exit(ensureBaileysInstalled() ? 0 : 1);
}

module.exports = {
  ensureBaileysInstalled,
  isInstalled,
  syncVendorCopy,
};
