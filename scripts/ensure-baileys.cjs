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
  openSync,
  closeSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} = require("node:fs");
const { tmpdir } = require("node:os");
const { dirname, join, resolve } = require("node:path");
const { pathToFileURL } = require("node:url");

const ENSURE_BAILEYS_SCRIPT_ID = "ensure-baileys-2026-07-26m";

const BAILEYS_SPEC = "@whiskeysockets/baileys@6.7.22";
const GATEWAY_SPECS = ["qrcode@1.5.4", "pino@10.3.1"];
/** Baileys paket dosyası varken Hostinger'ın budadığı runtime bağımlılıklar. */
const BAILEYS_RUNTIME_SPECS = [
  "protobufjs@^7.2.4",
  "ws@^8.13.0",
  "@hapi/boom@^9.1.3",
  "async-mutex@^0.5.0",
  "axios@^1.6.0",
  "music-metadata@^11.7.0",
  "@cacheable/node-cache@^1.4.0",
  "cacheable@^2.3.1",
  "hookified@^1.14.0",
  "keyv@^5.5.5",
];
const BAILEYS_RUNTIME_MARKERS = [
  "protobufjs/package.json",
  "ws/package.json",
  "ws/wrapper.mjs",
  "@hapi/boom/package.json",
  "async-mutex/package.json",
  "axios/package.json",
  "music-metadata/package.json",
  "@cacheable/node-cache/package.json",
  "cacheable/package.json",
  "hookified/package.json",
  "keyv/package.json",
  "long/package.json",
  "libsignal/package.json",
];
/** Baileys paketi yarım kaldığında (Hostinger eşzamanlı kopya) import patlar. */
const BAILEYS_INTEGRITY_MARKERS = [
  "@whiskeysockets/baileys/lib/index.js",
  "@whiskeysockets/baileys/WAProto/index.js",
  "ws/wrapper.mjs",
];
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

function resolveDataRoot() {
  try {
    return require("../prisma/persistent-paths.cjs").resolveDataRoot();
  } catch {
    return resolve(projectRoot, "data");
  }
}

const installLockFile = join(resolveDataRoot(), ".ensure-baileys.lock");
const persistentNmRoot = join(resolveDataRoot(), "baileys-node_modules");

function sleepMs(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    /* busy-wait — boot path, no async */
  }
}

/** Hostinger aynı anda birden fazla worker boot edince node_modules bozuluyor. */
function withInstallLock(fn) {
  const staleMs = 15 * 60 * 1000;
  const maxWaitMs = 180 * 1000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    try {
      if (existsSync(installLockFile)) {
        try {
          const age = Date.now() - statSync(installLockFile).mtimeMs;
          if (age > staleMs) {
            rmSync(installLockFile, { force: true });
          }
        } catch {
          /* ignore */
        }
      }
      mkdirSync(dirname(installLockFile), { recursive: true });
      const fd = openSync(installLockFile, "wx");
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      try {
        return fn();
      } finally {
        try {
          rmSync(installLockFile, { force: true });
        } catch {
          /* ignore */
        }
      }
    } catch (error) {
      if (error && error.code === "EEXIST") {
        sleepMs(800);
        continue;
      }
      throw error;
    }
  }
  console.warn("[WASYS] Baileys kurulum kilidi zaman aşımı — kilitsiz devam");
  return fn();
}

function missingIntegrityMarkers() {
  return BAILEYS_INTEGRITY_MARKERS.filter(
    (rel) => !existsSync(resolve(nmRoot, rel)),
  );
}

function isBaileysComplete() {
  return missingIntegrityMarkers().length === 0;
}

function copyPackageTree(fromRoot, toRoot, entry) {
  const from = resolve(fromRoot, entry);
  if (!existsSync(from)) return;
  if (entry.startsWith("@")) {
    const scopeTo = resolve(toRoot, entry);
    mkdirSync(scopeTo, { recursive: true });
    for (const scoped of readdirSync(from)) {
      const sFrom = resolve(from, scoped);
      const sTo = resolve(scopeTo, scoped);
      rmSync(sTo, { recursive: true, force: true });
      cpSync(sFrom, sTo, { recursive: true, force: true });
    }
    return;
  }
  const to = resolve(toRoot, entry);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true, force: true });
}

function deepHoist(rootNm) {
  for (let i = 0; i < 6; i++) {
    hoistNestedDependencies(rootNm);
  }
}

/** Gerçek ESM import — eksik transitif (long, cacheable, …) tek tek marker ile yakalanmaz. */
function verifyBaileysCanLoad() {
  if (!existsSync(nmEntry)) return false;
  const href = pathToFileURL(nmEntry).href;
  const script = `import(${JSON.stringify(href)}).then(()=>process.exit(0)).catch((e)=>{console.error(e.message||e);process.exit(1);});`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: projectRoot,
    env: process.env,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    const detail = (result.stdout || result.stderr || "").trim();
    if (detail) console.warn(`[WASYS] Baileys import probe: ${detail.slice(0, 400)}`);
    return false;
  }
  return true;
}

function snapshotPersistentFromInstall(srcNm) {
  if (!existsSync(srcNm)) return;
  try {
    rmSync(persistentNmRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  mkdirSync(persistentNmRoot, { recursive: true });
  copyAllNodeModulesFrom(srcNm, persistentNmRoot);
  deepHoist(persistentNmRoot);
  console.log(`[WASYS] Baileys npm ağacı kalıcı yedeklendi → ${persistentNmRoot}`);
}

function installFullBaileysTree() {
  console.warn(`[WASYS] Tam Baileys npm ağacı kuruluyor (${BAILEYS_SPEC})…`);
  return installViaPrefix([BAILEYS_SPEC], { snapshotPersistent: true });
}

function restorePersistentNodeModules() {
  if (!existsSync(resolve(persistentNmRoot, "@whiskeysockets/baileys/WAProto/index.js"))) {
    return false;
  }
  mkdirSync(nmRoot, { recursive: true });
  const entries = readdirSync(persistentNmRoot).filter(
    (e) => e !== ".bin" && !e.startsWith("."),
  );
  for (const entry of entries) {
    copyPackageTree(persistentNmRoot, nmRoot, entry);
  }
  deepHoist(nmRoot);
  console.log(`[WASYS] Baileys paketleri kalıcı dizinden geri yüklendi → ${persistentNmRoot}`);
  return verifyBaileysCanLoad();
}

function backupPersistentNodeModules() {
  /* snapshotPersistentFromInstall() kurulumdan sonra tam ağacı yedekler */
}

function purgeBrokenBaileys() {
  const missing = missingIntegrityMarkers();
  if (!missing.length) return;
  console.warn(
    `[WASYS] Baileys bütünlük hatası (yarım kurulum): ${missing.join(", ")} — yeniden kurulacak`,
  );
  try {
    rmSync(nmPackage, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  try {
    rmSync(vendorDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function isInstalled() {
  return existsSync(nmMarker) && existsSync(nmEntry);
}

function missingBaileysRuntimeDeps() {
  return BAILEYS_RUNTIME_MARKERS.filter(
    (rel) => !existsSync(resolve(nmRoot, rel)),
  );
}

function ensureBaileysRuntimeDeps() {
  deepHoist(nmRoot);
  if (verifyBaileysCanLoad()) {
    console.log("[WASYS] Baileys runtime deps hazır (ESM import OK)");
    return true;
  }

  const missing = missingBaileysRuntimeDeps();
  if (missing.length) {
    console.warn(
      `[WASYS] Baileys runtime işaretleri eksik: ${missing.join(", ")}`,
    );
  }

  installFullBaileysTree();
  deepHoist(nmRoot);

  if (!verifyBaileysCanLoad()) {
    console.error(
      "[WASYS] Baileys ESM import hâlâ başarısız. SSH:\n" +
        '  export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"\n' +
        "  cd ~/domains/wasys.pro/nodejs && node scripts/ensure-baileys.cjs",
    );
    return false;
  }

  if (!existsSync(resolve(nmRoot, "libsignal/package.json"))) {
    console.warn(
      "[WASYS] libsignal yok — WhatsApp bağlanınca gerekebilir (git bağımlılığı).",
    );
  }
  console.log("[WASYS] Baileys runtime deps kuruldu (tam npm ağacı)");
  return true;
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
  if (!isBaileysComplete()) {
    console.warn("[WASYS] Baileys vendor kopyası atlandı — paket eksik/bozuk");
    return false;
  }
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

function copyAllNodeModulesFrom(srcNm, toRoot) {
  if (!existsSync(srcNm)) return;
  mkdirSync(toRoot, { recursive: true });
  for (const entry of readdirSync(srcNm)) {
    if (entry === ".bin" || entry.startsWith(".")) continue;
    copyPackageTree(srcNm, toRoot, entry);
  }
}

/** npm bazen bağımlılıkları paket içi node_modules'te bırakır — ESM import kökten arar. */
function hoistNestedDependencies(rootNm) {
  if (!existsSync(rootNm)) return;
  const queue = [];
  for (const entry of readdirSync(rootNm)) {
    if (entry.startsWith(".")) continue;
    if (entry.startsWith("@")) {
      const scopePath = resolve(rootNm, entry);
      for (const scoped of readdirSync(scopePath)) {
        queue.push(resolve(scopePath, scoped));
      }
    } else {
      queue.push(resolve(rootNm, entry));
    }
  }
  for (const pkgDir of queue) {
    const nested = resolve(pkgDir, "node_modules");
    if (!existsSync(nested)) continue;
    copyAllNodeModulesFrom(nested, rootNm);
  }
}

/**
 * Paketleri boş bir prefix'e kur, sonra proje node_modules'e kopyala.
 * Proje kökünde npm install YAPMA — Hostinger'da next ENOTEMPTY/503 yapıyor.
 */
function installViaPrefix(specs, opts = {}) {
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
    copyAllNodeModulesFrom(srcNm, nmRoot);
    deepHoist(nmRoot);
    if (
      opts.snapshotPersistent ||
      specs.some((s) => String(s).includes("@whiskeysockets/baileys"))
    ) {
      snapshotPersistentFromInstall(srcNm);
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
  console.log(`[WASYS] ensure-baileys script=${ENSURE_BAILEYS_SCRIPT_ID}`);
  return withInstallLock(() => {
    ensureGatewayDeps();

    if (isInstalled() && !isBaileysComplete()) {
      purgeBrokenBaileys();
    }

    if (!isBaileysComplete() && restorePersistentNodeModules()) {
      console.log("[WASYS] Baileys kalıcı yedekten tamamlandı");
    }

    const needsFullInstall =
      !isInstalled() || !isBaileysComplete() || !verifyBaileysCanLoad();

    if (needsFullInstall) {
      console.warn(
        `[WASYS] ${BAILEYS_SPEC} eksik, bozuk veya import edilemiyor — tam kurulum…`,
      );

      const result = installFullBaileysTree();

      if (result.error) {
        console.error("[WASYS] Baileys npm install başlatılamadı:", result.error.message);
      } else if (result.status !== 0) {
        console.error(`[WASYS] Baileys npm install exit ${result.status}`);
      }

      if (!isBaileysComplete() || !verifyBaileysCanLoad()) {
        console.error(
          "[WASYS] Baileys hâlâ eksik/bozuk. hPanel → Redeploy (Entry file=server.js) ve npm install loglarını kontrol edin.",
        );
        return false;
      }
      console.log("[WASYS] Baileys kuruldu");
    } else {
      try {
        const version = require(nmMarker).version;
        console.log(`[WASYS] Baileys hazır (v${version})`);
      } catch {
        console.log("[WASYS] Baileys hazır");
      }
    }

    const runtimeOk = ensureBaileysRuntimeDeps();
    syncVendorCopy();
    return runtimeOk && verifyBaileysCanLoad();
  });
}

if (require.main === module) {
  process.exit(ensureBaileysInstalled() ? 0 : 1);
}

module.exports = {
  ensureBaileysInstalled,
  ensureGatewayDeps,
  isInstalled,
  isBaileysComplete,
  verifyBaileysCanLoad,
  installFullBaileysTree,
  syncVendorCopy,
  cleanNpmRenameLeftovers,
  installViaPrefix,
};
