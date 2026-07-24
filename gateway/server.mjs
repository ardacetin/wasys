import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import pino from "pino";

const PORT = Number(process.env.GATEWAY_PORT ?? 4001);
const SECRET = process.env.GATEWAY_SECRET ?? "wasys-gateway-secret";
// Persistent dir (survives redeploys) — same place as the SQLite DB.
const DATA_ROOT = process.env.GATEWAY_DATA_DIR ?? path.join(process.cwd(), "data");
const AUTH_ROOT = path.join(DATA_ROOT, "gateway-auth");
const REGISTRY_FILE = path.join(DATA_ROOT, "gateway-sessions.json");
const logger = pino({ level: "info" });

/**
 * @typedef {Object} SessionState
 * @property {string} channelId
 * @property {string} sessionId
 * @property {string} webhookUrl
 * @property {"CONNECTING"|"QR_PENDING"|"CONNECTED"|"DISCONNECTED"|"ERROR"} status
 * @property {string=} qrDataUrl
 * @property {string=} phoneNumber
 * @property {string=} lastError
 * @property {import("@whiskeysockets/baileys").WASocket=} sock
 */

/** @type {Map<string, SessionState>} */
const sessions = new Map();

function ensureAuthDir() {
  if (!fs.existsSync(AUTH_ROOT)) fs.mkdirSync(AUTH_ROOT, { recursive: true });
}

function saveRegistry() {
  try {
    const entries = [...sessions.values()].map((s) => ({
      channelId: s.channelId,
      sessionId: s.sessionId,
      webhookUrl: s.webhookUrl,
    }));
    fs.mkdirSync(DATA_ROOT, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(entries, null, 2));
  } catch (err) {
    logger.warn({ err }, "failed to persist session registry");
  }
}

function resumeSessions() {
  if (!fs.existsSync(REGISTRY_FILE)) return;
  try {
    const entries = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    for (const entry of entries) {
      if (!entry?.sessionId || sessions.has(entry.sessionId)) continue;
      const authDir = path.join(AUTH_ROOT, entry.sessionId);
      // Only resume sessions that were actually paired before.
      if (!fs.existsSync(path.join(authDir, "creds.json"))) continue;
      const session = {
        channelId: entry.channelId,
        sessionId: entry.sessionId,
        webhookUrl: entry.webhookUrl,
        status: "CONNECTING",
      };
      sessions.set(entry.sessionId, session);
      logger.info({ sessionId: entry.sessionId }, "resuming WhatsApp session");
      void startSocket(session);
    }
  } catch (err) {
    logger.warn({ err }, "failed to resume sessions");
  }
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function unauthorized(res) {
  json(res, 401, { error: "Unauthorized" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
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

async function notifyWebhook(session, event, payload) {
  try {
    await fetch(session.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gateway-secret": SECRET,
      },
      body: JSON.stringify({
        event,
        sessionId: session.sessionId,
        channelId: session.channelId,
        ...payload,
      }),
    });
  } catch (err) {
    logger.error({ err, sessionId: session.sessionId }, "webhook failed");
  }
}

function jidToPhone(jid) {
  return jid.split("@")[0]?.split(":")[0] ?? jid;
}

async function startSocket(session) {
  ensureAuthDir();
  const authDir = path.join(AUTH_ROOT, session.sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  session.status = "CONNECTING";
  session.lastError = undefined;

  // WhatsApp rejects outdated protocol versions with a 405 — always fetch latest.
  let waVersion;
  try {
    const { version } = await fetchLatestBaileysVersion();
    waVersion = version;
  } catch {
    waVersion = undefined;
  }

  const sock = makeWASocket({
    version: waVersion,
    auth: state,
    browser: ["WASYS", "Chrome", "1.0.0"],
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
      session.qrDataUrl = await qrcode.toDataURL(qr, { margin: 1, width: 320 });
      await notifyWebhook(session, "qr", {
        qrDataUrl: session.qrDataUrl,
        status: session.status,
      });
    }

    if (connection === "open") {
      session.status = "CONNECTED";
      session.qrDataUrl = undefined;
      session.phoneNumber = sock.user?.id ? jidToPhone(sock.user.id) : undefined;
      saveRegistry();
      await notifyWebhook(session, "connected", {
        status: session.status,
        phoneNumber: session.phoneNumber,
      });
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      session.status = "DISCONNECTED";
      session.qrDataUrl = undefined;

      await notifyWebhook(session, "disconnected", {
        status: session.status,
        code,
        shouldReconnect: !loggedOut,
      });

      if (loggedOut) {
        // Phone unlinked this device — wipe creds so a new QR can be issued.
        try {
          fs.rmSync(authDir, { recursive: true, force: true });
        } catch {}
        sessions.delete(session.sessionId);
        saveRegistry();
      } else {
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

async function handleIncoming(session, msg) {
  if (msg.key.fromMe) return;
  const remoteJid = msg.key.remoteJid;
  if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") return;

  const phone = jidToPhone(remoteJid);
  const pushName = msg.pushName ?? undefined;
  const externalId = msg.key.id ?? undefined;

  let type = "TEXT";
  let body;
  let mediaUrl;
  let mediaMimeType;

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
      fs.writeFileSync(path.join(mediaDir, filename), buffer);
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

async function sendText(sessionId, to, text) {
  const session = sessions.get(sessionId);
  if (!session?.sock || session.status !== "CONNECTED") {
    throw new Error("Session not connected");
  }
  const jid = `${to.replace(/\D/g, "")}@s.whatsapp.net`;
  const result = await session.sock.sendMessage(jid, { text });
  return { externalId: result?.key?.id };
}

async function sendAudio(sessionId, to, audioUrl, ptt = true) {
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
      saveRegistry();

      // Already connected? Don't restart the socket.
      if (session.status !== "CONNECTED" || !session.sock) {
        void startSocket(session);
      }
      return json(res, 200, {
        ok: true,
        status: session.status,
        qrDataUrl: session.qrDataUrl,
        phoneNumber: session.phoneNumber,
      });
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
      const authDir = path.join(AUTH_ROOT, stopMatch[1]);
      try {
        fs.rmSync(authDir, { recursive: true, force: true });
      } catch {}
      sessions.delete(stopMatch[1]);
      saveRegistry();
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

export function startGateway() {
  ensureAuthDir();
  return new Promise((resolve) => {
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        logger.warn(`Gateway port ${PORT} already in use — assuming gateway is running`);
        resolve(false);
      } else {
        logger.error({ err }, "gateway server error");
      }
    });
    server.listen(PORT, "127.0.0.1", () => {
      logger.info(`WASYS WhatsApp gateway listening on 127.0.0.1:${PORT}`);
      resumeSessions();
      resolve(true);
    });
  });
}

// Standalone: `node gateway/server.mjs`
if (process.argv[1] && process.argv[1].endsWith("server.mjs")) {
  void startGateway();
}
