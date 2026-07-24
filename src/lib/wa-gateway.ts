/**
 * WhatsApp gateway istemcisi.
 *
 * Hostinger'da Next + Baileys aynı Node sürecinde çalışır (server.js).
 * Bu durumda globalThis.__wasysGateway üzerinden doğrudan çağrı yapılır —
 * 4001 portuna HTTP gerekmez (paylaşımlı hostingde loopback engelli olabilir).
 *
 * GATEWAY_MODE=http veya in-process API yoksa eski HTTP yoluna düşer.
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

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://127.0.0.1:4001";
const GATEWAY_SECRET = process.env.GATEWAY_SECRET ?? "wasys-gateway-secret";
const FORCE_HTTP = process.env.GATEWAY_MODE === "http";

function inProcessGateway(): GatewayOps | null {
  if (FORCE_HTTP) return null;
  const ops = (globalThis as { __wasysGateway?: GatewayOps }).__wasysGateway;
  return ops ?? null;
}

/** Webhook köprüsünün yüklü olduğundan emin ol (in-process olaylar için). */
async function ensureWebhookBridge() {
  if ((globalThis as { __wasysGatewayWebhook?: unknown }).__wasysGatewayWebhook) {
    return;
  }
  try {
    await import("@/lib/gateway-webhook");
  } catch (error) {
    console.warn("[WASYS] gateway-webhook bridge yüklenemedi", error);
  }
}

async function gatewayFetch(path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${GATEWAY_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-gateway-secret": GATEWAY_SECRET,
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `WhatsApp servisine ulaşılamadı (${detail}). Sunucu Entry file=server.js olmalı ve Redeploy sonrası gateway başlamalı.`,
    );
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Gateway error ${res.status}`,
    );
  }
  return data;
}

export const waGateway = {
  async startSession(payload: {
    channelId: string;
    sessionId: string;
    webhookUrl: string;
  }) {
    await ensureWebhookBridge();
    const ops = inProcessGateway();
    if (ops) return ops.startSession(payload);
    return gatewayFetch("/sessions/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getStatus(sessionId: string) {
    const ops = inProcessGateway();
    if (ops) return ops.getStatus(sessionId);
    return gatewayFetch(`/sessions/${sessionId}/status`);
  },

  async stopSession(sessionId: string) {
    const ops = inProcessGateway();
    if (ops) return ops.stopSession(sessionId);
    return gatewayFetch(`/sessions/${sessionId}/stop`, { method: "POST" });
  },

  async sendText(payload: {
    sessionId: string;
    to: string;
    text: string;
  }) {
    const ops = inProcessGateway();
    if (ops) return ops.sendText(payload);
    return gatewayFetch("/messages/text", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async sendAudio(payload: {
    sessionId: string;
    to: string;
    audioUrl: string;
    ptt?: boolean;
  }) {
    const ops = inProcessGateway();
    if (ops) return ops.sendAudio(payload);
    return gatewayFetch("/messages/audio", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
