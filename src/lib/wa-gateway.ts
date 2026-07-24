const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:4001";
const GATEWAY_SECRET = process.env.GATEWAY_SECRET ?? "wasys-gateway-secret";

async function gatewayFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-gateway-secret": GATEWAY_SECRET,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Gateway error ${res.status}`);
  }
  return data;
}

export const waGateway = {
  startSession(payload: {
    channelId: string;
    sessionId: string;
    webhookUrl: string;
  }) {
    return gatewayFetch("/sessions/start", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getStatus(sessionId: string) {
    return gatewayFetch(`/sessions/${sessionId}/status`);
  },
  stopSession(sessionId: string) {
    return gatewayFetch(`/sessions/${sessionId}/stop`, { method: "POST" });
  },
  sendText(payload: {
    sessionId: string;
    to: string;
    text: string;
  }) {
    return gatewayFetch("/messages/text", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  sendAudio(payload: {
    sessionId: string;
    to: string;
    audioUrl: string;
    ptt?: boolean;
  }) {
    return gatewayFetch("/messages/audio", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
