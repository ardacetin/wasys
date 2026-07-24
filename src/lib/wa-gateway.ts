/**
 * WhatsApp gateway istemcisi.
 *
 * Hostinger'da Baileys, Next API route'larıyla aynı Node sürecinde çalışmalı.
 * server.js gateway'i başlatmamış olsa bile (veya Entry file yanlış olsa bile)
 * ilk QR/bağlan isteğinde gateway burada lazy-start edilir — HTTP :4001'e
 * bağımlılık yok.
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
  }) => Promise<{ externalId?: string }>;
  sendAudio: (payload: {
    sessionId: string;
    to: string;
    audioUrl: string;
    ptt?: boolean;
  }) => Promise<{ externalId?: string }>;
};

type GatewayModule = {
  startGateway: () => Promise<boolean>;
  gatewayOps: GatewayOps;
};

const globalStore = globalThis as {
  __wasysGateway?: GatewayOps;
  __wasysGatewayStart?: Promise<GatewayOps> | null;
  __wasysGatewayWebhook?: unknown;
};

async function ensureWebhookBridge() {
  if (globalStore.__wasysGatewayWebhook) return;
  try {
    await import("@/lib/gateway-webhook");
  } catch (error) {
    console.warn("[WASYS] gateway-webhook bridge yüklenemedi", error);
  }
}

async function loadGatewayModule(): Promise<GatewayModule> {
  // Runtime absolute import — Next webpack gateway/server.mjs'i paketlemez.
  const { pathToFileURL } = await import("node:url");
  const { join } = await import("node:path");
  const gatewayPath = join(process.cwd(), "gateway", "server.mjs");
  return import(pathToFileURL(gatewayPath).href) as Promise<GatewayModule>;
}

/**
 * Gateway'i süreç içinde hazırla. server.js zaten başlattıysa no-op;
 * başlamadıysa burada Baileys'i ayağa kaldırır.
 */
async function ensureGateway(): Promise<GatewayOps> {
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
        console.log("[WASYS] WhatsApp gateway in-process ready (lazy)");
        return ops;
      } catch (error) {
        globalStore.__wasysGatewayStart = null;
        const detail = error instanceof Error ? error.message : String(error);
        console.error("[WASYS] WhatsApp gateway lazy-start failed", error);
        throw new Error(
          `WhatsApp servisi başlatılamadı: ${detail}. Baileys bağımlılıklarının kurulu olduğundan ve Entry file=server.js ile Redeploy yapıldığından emin olun.`,
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
  }) {
    const ops = await ensureGateway();
    return ops.sendText(payload);
  },

  async sendAudio(payload: {
    sessionId: string;
    to: string;
    audioUrl: string;
    ptt?: boolean;
  }) {
    const ops = await ensureGateway();
    return ops.sendAudio(payload);
  },
};

/** Health / teşhis için: gateway şu an süreç içinde hazır mı? */
export function isGatewayReady() {
  return Boolean(globalStore.__wasysGateway);
}
