/**
 * Hostinger Redeploy bazen node_modules'ü eksik bırakır veya Next izleme
 * Baileys'i budar. Gateway import'tan önce paketin varlığını doğrula.
 *
 * ÖNEMLİ: Proje kökünde `npm install qrcode` gibi komutlar Hostinger'da
 * ENOTEMPTY ile `next` klasörünü bozabiliyor (503). Eksik paketleri
 * geçici prefix'e kurup node_modules'e kopyala — next'e dokunma.
 */
const { spawnSync } = require("node:child_process");
const {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join, resolve } = require("node:path");

const BAILEYS_SPEC = "@whiskeysockets/baileys@6.7.22";
const GATEWAY_SPECS = ["qrcode@1.5.4", "pino@10.3.1"];
const projectRoot = resolve(__dirname, "..");
const nmRoot = resolve(projectRoot, "node_modules");
const nmPackage = resolve(nmRoot, "@whiskeysockets/baileys");
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

/** npm ENOTEMPTY sonrası kalan `node_modules/.next-XXXX` klasörlerini temizle. */
function cleanNpmRenameLeftovers() {
  if (!existsSync(nmRoot)) return;
  for (const name of readdirSync(nmRoot)) {
    if (!name.startsWith(".")) continue;
    // .next-UskkxMtt, .qrcode-xxxx, vb. yarım rename artıkları
    if (!/^[a-zA-Z0-9_.-]+-[A-Za-z0-9]{6,}$/.test(name) && !name.startsWith(".next-")) {
      continue;
    }
    try {
      rmSync(resolve(nmRoot, name), { recursive: true, force: true });
      console.log(`[WASYS] npm rename artığı silindi: node_modules/${name}`);
    } catch {
      /* ignore */
    }
  }
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

/**
 * Paketleri boş bir prefix'e kur, sonra proje node_modules'e kopyala.
 * Proje kökünde npm install YAPMA — Hostinger'da next ENOTEMPTY/503 yapıyor.
 */
function installViaPrefix(specs) {
  cleanNpmRenameLeftovers();
  const tmp = mkdtempSync(join(tmpdir(), "wasys-npm-"));
  try {
    writeFileSync(
      resolve(tmp, "package.json"),
      JSON.stringify({ name: "wasys-tmp-install", private: true }, null, 2),
    );
    const npm = resolveNpm();
    const args = [
      ...npm.prefixArgs,
      "install",
      ...specs,
      "--prefix",
      tmp,
      "--omit=dev",
      "--legacy-peer-deps",
      "--no-audit",
      "--no-fund",
    ];
    console.log(`[WASYS] İzole kurulum: ${specs.join(" ")} → ${tmp}`);
    const result = spawnSync(npm.command, args, {
      cwd: tmp,
      env: withNodeOnPath(),
      stdio: "inherit",
    });

    const srcNm = resolve(tmp, "node_modules");
    if (!existsSync(srcNm)) {
      return result;
    }

    mkdirSync(nmRoot, { recursive: true });
    for (const entry of readdirSync(srcNm)) {
      if (entry === ".bin" || entry.startsWith(".")) continue;
      const from = resolve(srcNm, entry);
      const to = resolve(nmRoot, entry);
      // Scoped packages (@whiskeysockets): merge into scope dir
      if (entry.startsWith("@")) {
        mkdirSync(to, { recursive: true });
        for (const scoped of readdirSync(from)) {
          const sFrom = resolve(from, scoped);
          const sTo = resolve(to, scoped);
          rmSync(sTo, { recursive: true, force: true });
          cpSync(sFrom, sTo, { recursive: true, force: true });
        }
        continue;
      }
      rmSync(to, { recursive: true, force: true });
      cpSync(from, to, { recursive: true, force: true });
    }
    return result;
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

function ensureGatewayDeps() {
  cleanNpmRenameLeftovers();

  const deps = [
    {
      name: "qrcode",
      marker: resolve(nmRoot, "qrcode/lib/index.js"),
    },
    {
      name: "pino",
      marker: resolve(nmRoot, "pino/pino.js"),
    },
  ];
  const missing = deps.filter((dep) => !existsSync(dep.marker));
  if (missing.length === 0) {
    console.log("[WASYS] Gateway deps hazır (qrcode, pino)");
    return true;
  }

  console.warn(
    `[WASYS] Gateway deps eksik: ${missing.map((d) => d.name).join(", ")} — izole kurulum…`,
  );
  installViaPrefix(GATEWAY_SPECS);

  const stillMissing = deps.filter((dep) => !existsSync(dep.marker)).map((d) => d.name);
  if (stillMissing.length) {
    console.error(`[WASYS] Gateway deps hâlâ yok: ${stillMissing.join(", ")}`);
    console.error(
      "[WASYS] SSH (next'e dokunmadan):\n" +
        '  TMP=$(mktemp -d) && npm install qrcode@1.5.4 pino@10.3.1 --prefix "$TMP" --omit=dev --legacy-peer-deps && cp -a "$TMP"/node_modules/. ./node_modules/ && rm -rf "$TMP"',
    );
    return false;
  }
  console.log("[WASYS] Gateway deps kuruldu (izole prefix)");
  return true;
}

function ensureBaileysInstalled() {
  ensureGatewayDeps();

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
    `[WASYS] ${BAILEYS_SPEC} eksik — izole kurulum deneniyor (Hostinger node_modules budaması)`,
  );

  const result = installViaPrefix([BAILEYS_SPEC]);

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
  ensureGatewayDeps,
  isInstalled,
  syncVendorCopy,
  cleanNpmRenameLeftovers,
  installViaPrefix,
};
