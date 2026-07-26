/**
 * WhatsApp gateway istemcisi.
 *
 * Next/Turbopack dinamik import(path) ifadesini "too dynamic" diye reddeder.
 * Bu yüzden gateway/server.mjs runtime'da Function üzerinden yüklenir.
 * server.js veya instrumentation.ts zaten başlattıysa globalThis kullanılır.
 */

type GatewayOps = {
  health: () => { ok: boolean; sessions: number };
  startSession: (payload: {
    channelId: string;
    sessionId: string;
    webhookUrl: string;
  }) => Promise<{
    ok: boolean;
    status: string;
    qrDataUrl?: string;
    phoneNumber?: string;
  }>;
  getStatus: (sessionId: string) => Promise<{
    status: string;
    qrDataUrl?: string;
    phoneNumber?: string;
    lastError?: string;
  }>;
  stopSession: (sessionId: string) => Promise<{ ok: boolean }>;
  sendText: (payload: {
    sessionId: string;
    to: string;
    text: string;
    jid?: string | null;
  }) => Promise<{ externalId?: string; jid?: string }>;
  sendAudio: (payload: {
    sessionId: string;
    to: string;
    audioUrl: string;
    ptt?: boolean;
    jid?: string | null;
  }) => Promise<{ externalId?: string; jid?: string }>;
};

type GatewayModule = {
  startGateway: () => Promise<boolean>;
  gatewayOps: GatewayOps;
};

const globalStore = globalThis as {
  __wasysGateway?: GatewayOps;
  __wasysGatewayStart?: Promise<GatewayOps> | null;
  __wasysGatewayWebhook?: unknown;
  __wasysGatewayLastError?: string | null;
  __wasysGatewayLoaderId?: string;
};

/** Turbopack/webpack'in statik analizinden kaçınan gerçek runtime import. */
function runtimeImport(specifier: string): Promise<GatewayModule> {
  const importer = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<GatewayModule>;
  return importer(specifier);
}

async function ensureWebhookBridge() {
  if (globalStore.__wasysGatewayWebhook) return;
  try {
    await import("@/lib/gateway-webhook");
  } catch (error) {
    console.warn("[WASYS] gateway-webhook bridge yüklenemedi", error);
  }
}

async function loadGatewayModule(): Promise<GatewayModule> {
  const { pathToFileURL } = await import("node:url");
  const { join } = await import("node:path");
  const { existsSync, statSync } = await import("node:fs");
  const { createRequire } = await import("node:module");

  // Next instrumentation yolu: server.js atlandıysa da Baileys'i kurtar.
  try {
    const require = createRequire(join(process.cwd(), "package.json"));
    const ensurePath = join(process.cwd(), "scripts/ensure-baileys.cjs");
    if (existsSync(ensurePath)) {
      require(ensurePath).ensureBaileysInstalled();
    }
  } catch (error) {
    console.warn("[WASYS] ensure-baileys atlandı", error);
  }

  const baileysCandidates = [
    join(process.cwd(), "gateway/vendor/baileys/lib/index.js"),
    join(process.cwd(), "node_modules/@whiskeysockets/baileys/lib/index.js"),
  ];
  if (!baileysCandidates.some((entry) => existsSync(entry))) {
    throw new Error(
      `Baileys kurulu değil. Denenen: ${baileysCandidates.join(" | ")}. SSH: npm install @whiskeysockets/baileys@6.7.22 --omit=dev --legacy-peer-deps && node scripts/ensure-baileys.cjs`,
    );
  }

  // Yeni dosya adı: Hostinger bazen eski gateway/server.mjs'i (bare import)
  // güncellemeden bırakıyor. wa-runtime.mjs zorunlu.
  const gatewayPath = join(process.cwd(), "gateway", "wa-runtime.mjs");
  if (!existsSync(gatewayPath)) {
    throw new Error(
      `gateway/wa-runtime.mjs bulunamadı: ${gatewayPath}. Git'ten son main'i Redeploy edin (Entry file=server.js).`,
    );
  }

  // mtime ile cache bust — Hostinger'da eski ESM cache kalmasın.
  const bust = statSync(gatewayPath).mtimeMs;
  return runtimeImport(`${pathToFileURL(gatewayPath).href}?t=${bust}`);
}

/**
 * Gateway'i süreç içinde hazırla. server.js / instrumentation zaten
 * başlattıysa globalThis üzerinden döner; yoksa lazy-start eder.
 */
export async function ensureGateway(): Promise<GatewayOps> {
  if (globalStore.__wasysGateway) return globalStore.__wasysGateway;

  if (!globalStore.__wasysGatewayStart) {
    globalStore.__wasysGatewayStart = (async () => {
      await ensureWebhookBridge();
      try {
        const mod = await loadGatewayModule();
        await mod.startGateway();
        const ops = globalStore.__wasysGateway ?? mod.gatewayOps;
        if (!ops) {
          throw new Error("gatewayOps kaydı oluşmadı");
        }
        globalStore.__wasysGateway = ops;
        globalStore.__wasysGatewayLastError = null;
        console.log("[WASYS] WhatsApp gateway in-process ready");
        return ops;
      } catch (error) {
        globalStore.__wasysGatewayStart = null;
        const detail = error instanceof Error ? error.message : String(error);
        globalStore.__wasysGatewayLastError = detail;
        console.error("[WASYS] WhatsApp gateway start failed", error);
        throw new Error(
          `WhatsApp servisi başlatılamadı: ${detail}. Entry file=server.js ile son main'i Redeploy edin; SSH: node scripts/ensure-baileys.cjs`,
        );
      }
    })();
  }

  return globalStore.__wasysGatewayStart;
}

export const waGateway = {
  async startSession(payload: {
    channelId: string;
    sessionId: string;
    webhookUrl: string;
  }) {
    const ops = await ensureGateway();
    return ops.startSession(payload);
  },

  async getStatus(sessionId: string) {
    const ops = await ensureGateway();
    return ops.getStatus(sessionId);
  },

  async stopSession(sessionId: string) {
    const ops = await ensureGateway();
    return ops.stopSession(sessionId);
  },

  async sendText(payload: {
    sessionId: string;
    to: string;
    text: string;
    jid?: string | null;
  }) {
    const ops = await ensureGateway();
    return ops.sendText(payload);
  },

  async sendAudio(payload: {
    sessionId: string;
    to: string;
    audioUrl: string;
    ptt?: boolean;
    jid?: string | null;
  }) {
    const ops = await ensureGateway();
    return ops.sendAudio(payload);
  },
};

export function isGatewayReady() {
  return Boolean(globalStore.__wasysGateway);
}

export function getGatewayLastError() {
  return globalStore.__wasysGatewayLastError ?? null;
}

export function getGatewayLoaderId() {
  return globalStore.__wasysGatewayLoaderId ?? null;
}

/** Health için: hazır değilse bir kez başlatmayı dene, sonucu raporla. */
export async function probeGateway(timeoutMs = 12000): Promise<{
  ready: boolean;
  error: string | null;
  warmed: boolean;
}> {
  if (globalStore.__wasysGateway) {
    return { ready: true, error: null, warmed: false };
  }
  let warmed = false;
  try {
    warmed = true;
    await Promise.race([
      ensureGateway(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Gateway start timeout (${timeoutMs}ms)`)), timeoutMs),
      ),
    ]);
    return { ready: Boolean(globalStore.__wasysGateway), error: null, warmed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    globalStore.__wasysGatewayLastError = message;
    return {
      ready: Boolean(globalStore.__wasysGateway),
      error: message,
      warmed,
    };
  }
}
