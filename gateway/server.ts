import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } from "@whiskeysockets/baileys";
import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import pino from "pino";

const PORT = Number(process.env.GATEWAY_PORT ?? 4001);
const SECRET = process.env.GATEWAY_SECRET ?? "wasys-gateway-secret";
const AUTH_ROOT = path.join(process.cwd(), "gateway-auth");
const logger = pino({ level: "info" });

type SessionState = {
  channelId: string;
  sessionId: string;
  webhookUrl: string;
  status: "CONNECTING" | "QR_PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
  qrDataUrl?: string;
  phoneNumber?: string;
  lastError?: string;
  sock?: WASocket;
};

const sessions = new Map<string, SessionState>();

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_ROOT)) fs.mkdirSync(AUTH_ROOT, { recursive: true });
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function unauthorized(res: http.ServerResponse) {
  json(res, 401, { error: "Unauthorized" });
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

async function notifyWebhook(session: SessionState, event: string, payload: Record<string, unknown>) {
  try {
    await fetch(session.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gateway-secret": SECRET,
      },
      body: JSON.stringify({ event, sessionId: session.sessionId, channelId: session.channelId, ...payload }),
    });
  } catch (err) {
    logger.error({ err, sessionId: session.sessionId }, "webhook failed");
  }
}

function jidToPhone(jid: string) {
  return jid.split("@")[0]?.split(":")[0] ?? jid;
}

async function startSocket(session: SessionState) {
  ensureAuthDir();
  const authDir = path.join(AUTH_ROOT, session.sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  session.status = "CONNECTING";
  session.lastError = undefined;

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  session.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      session.status = "QR_PENDING";
      session.qrDataUrl = await qrcode.toDataURL(qr);
      await notifyWebhook(session, "qr", { qrDataUrl: session.qrDataUrl, status: session.status });
    }

    if (connection === "open") {
      session.status = "CONNECTED";
      session.qrDataUrl = undefined;
      session.phoneNumber = sock.user?.id ? jidToPhone(sock.user.id) : undefined;
      await notifyWebhook(session, "connected", {
        status: session.status,
        phoneNumber: session.phoneNumber,
      });
    }

    if (connection === "close") {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      session.status = "DISCONNECTED";
      session.qrDataUrl = undefined;

      await notifyWebhook(session, "disconnected", {
        status: session.status,
        code,
        shouldReconnect,
      });

      if (shouldReconnect) {
        setTimeout(() => {
          void startSocket(session);
        }, 2000);
      }
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      await handleIncoming(session, msg);
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const u of updates) {
      const status = u.update.status;
      if (!u.key?.id || status == null) continue;
      const mapped =
        status === 4 ? "READ" : status === 3 ? "DELIVERED" : status === 2 ? "SENT" : null;
      if (!mapped) continue;
      await notifyWebhook(session, "message_status", {
        externalId: u.key.id,
        status: mapped,
      });
    }
  });
}

async function handleIncoming(session: SessionState, msg: WAMessage) {
  if (msg.key.fromMe) return;
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") return;

  const phone = jidToPhone(remoteJid);
  const pushName = msg.pushName ?? undefined;
  const externalId = msg.key.id ?? undefined;

  let type: "TEXT" | "AUDIO" | "IMAGE" | "VIDEO" | "DOCUMENT" = "TEXT";
  let body: string | undefined;
  let mediaUrl: string | undefined;
  let mediaMimeType: string | undefined;

  if (msg.message?.conversation) {
    body = msg.message.conversation;
  } else if (msg.message?.extendedTextMessage?.text) {
    body = msg.message.extendedTextMessage.text;
  } else if (msg.message?.audioMessage) {
    type = "AUDIO";
    mediaMimeType = msg.message.audioMessage.mimetype ?? "audio/ogg";
    body = "[Sesli mesaj]";
    try {
      const buffer = await downloadMediaMessage(msg, "buffer", {});
      const mediaDir = path.join(process.cwd(), "public", "uploads", "audio");
      fs.mkdirSync(mediaDir, { recursive: true });
      const filename = `${externalId ?? Date.now()}.ogg`;
      fs.writeFileSync(path.join(mediaDir, filename), buffer as Buffer);
      mediaUrl = `/uploads/audio/${filename}`;
    } catch (err) {
      logger.warn({ err }, "audio download failed");
    }
  } else if (msg.message?.imageMessage) {
    type = "IMAGE";
    body = msg.message.imageMessage.caption ?? "[Görsel]";
    mediaMimeType = msg.message.imageMessage.mimetype ?? "image/jpeg";
  } else if (msg.message?.documentMessage) {
    type = "DOCUMENT";
    body = msg.message.documentMessage.fileName ?? "[Dosya]";
    mediaMimeType = msg.message.documentMessage.mimetype ?? undefined;
  } else {
    body = "[Desteklenmeyen mesaj]";
  }

  await notifyWebhook(session, "message", {
    from: phone,
    pushName,
    externalId,
    type,
    body,
    mediaUrl,
    mediaMimeType,
  });
}

async function sendText(sessionId: string, to: string, text: string) {
  const session = sessions.get(sessionId);
  if (!session?.sock || session.status !== "CONNECTED") {
    throw new Error("Session not connected");
  }
  const jid = `${to.replace(/\D/g, "")}@s.whatsapp.net`;
  const result = await session.sock.sendMessage(jid, { text });
  return { externalId: result?.key?.id };
}

async function sendAudio(sessionId: string, to: string, audioUrl: string, ptt = true) {
  const session = sessions.get(sessionId);
  if (!session?.sock || session.status !== "CONNECTED") {
    throw new Error("Session not connected");
  }
  const jid = `${to.replace(/\D/g, "")}@s.whatsapp.net`;
  const localPath = audioUrl.startsWith("/")
    ? path.join(process.cwd(), "public", audioUrl.replace(/^\//, ""))
    : audioUrl;
  const buffer = fs.readFileSync(localPath);
  const result = await session.sock.sendMessage(jid, {
    audio: buffer,
    mimetype: "audio/ogg; codecs=opus",
    ptt,
  });
  return { externalId: result?.key?.id };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (req.headers["x-gateway-secret"] !== SECRET && url.pathname !== "/health") {
    return unauthorized(res);
  }

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true, sessions: sessions.size });
    }

    if (req.method === "POST" && url.pathname === "/sessions/start") {
      const body = await readBody(req);
      const { channelId, sessionId, webhookUrl } = body;
      if (!channelId || !sessionId || !webhookUrl) {
        return json(res, 400, { error: "channelId, sessionId, webhookUrl required" });
      }

      let session = sessions.get(sessionId);
      if (!session) {
        session = { channelId, sessionId, webhookUrl, status: "CONNECTING" };
        sessions.set(sessionId, session);
      } else {
        session.channelId = channelId;
        session.webhookUrl = webhookUrl;
      }

      void startSocket(session);
      return json(res, 200, { ok: true, status: session.status, qrDataUrl: session.qrDataUrl });
    }

    const statusMatch = url.pathname.match(/^\/sessions\/([^/]+)\/status$/);
    if (req.method === "GET" && statusMatch) {
      const session = sessions.get(statusMatch[1]);
      if (!session) return json(res, 404, { error: "Session not found" });
      return json(res, 200, {
        status: session.status,
        qrDataUrl: session.qrDataUrl,
        phoneNumber: session.phoneNumber,
        lastError: session.lastError,
      });
    }

    const stopMatch = url.pathname.match(/^\/sessions\/([^/]+)\/stop$/);
    if (req.method === "POST" && stopMatch) {
      const session = sessions.get(stopMatch[1]);
      if (session?.sock) {
        await session.sock.logout().catch(() => undefined);
        session.sock.end(undefined);
      }
      sessions.delete(stopMatch[1]);
      return json(res, 200, { ok: true });
    }

    if (req.method === "POST" && url.pathname === "/messages/text") {
      const body = await readBody(req);
      const result = await sendText(body.sessionId, body.to, body.text);
      return json(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/messages/audio") {
      const body = await readBody(req);
      const result = await sendAudio(body.sessionId, body.to, body.audioUrl, body.ptt ?? true);
      return json(res, 200, result);
    }

    json(res, 404, { error: "Not found" });
  } catch (err) {
    logger.error({ err }, "request failed");
    json(res, 500, { error: err instanceof Error ? err.message : "Internal error" });
  }
});

ensureAuthDir();
server.listen(PORT, () => {
  logger.info(`WASYS WhatsApp gateway listening on :${PORT}`);
});
