import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import qrcode from "qrcode";
import pino from "pino";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const requireFromRoot = createRequire(path.join(PROJECT_ROOT, "package.json"));

/**
 * Hostinger'da bare `@whiskeysockets/baileys` bazen çözülmez (eksik/budanmış
 * node_modules). Mutlak dosya yolundan yükle.
 * @returns {Promise<typeof import("@whiskeysockets/baileys")>}
 */
async function loadBaileys() {
  const candidates = [
    path.join(PROJECT_ROOT, "node_modules/@whiskeysockets/baileys/lib/index.js"),
    path.join(PROJECT_ROOT, "node_modules/@whiskeysockets/baileys/lib/index.mjs"),
  ];

  for (const file of candidates) {
    if (fs.existsSync(file)) {
      return import(pathToFileURL(file).href);
    }
  }

  try {
    const resolved = requireFromRoot.resolve("@whiskeysockets/baileys");
    return import(pathToFileURL(resolved).href);
  } catch {
    // fall through
  }

  try {
    return await import("@whiskeysockets/baileys");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Baileys bulunamadı (${path.join(PROJECT_ROOT, "node_modules/@whiskeysockets/baileys")}). ` +
        `SSH: npm install @whiskeysockets/baileys@6.7.22 --omit=dev --legacy-peer-deps && panelden Redeploy. ` +
        `Detay: ${detail}`,
    );
  }
}

/** @type {Awaited<ReturnType<typeof loadBaileys>> | null} */
let baileys = null;

async function getBaileys() {
  if (!baileys) baileys = await loadBaileys();
  return baileys;
}

const PORT = Number(process.env.GATEWAY_PORT ?? 4001);
const SECRET = process.env.GATEWAY_SECRET ?? "wasys-gateway-secret";
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
 * @property {any=} sock
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
  const body = {
    event,
    sessionId: session.sessionId,
    channelId: session.channelId,
    ...payload,
  };

  const inProcessHandler = globalThis.__wasysGatewayWebhook;
  if (typeof inProcessHandler === "function") {
    try {
      const result = await inProcessHandler(body);
      if (result && typeof result.status === "number" && result.status >= 400) {
        logger.warn(
          { event, sessionId: session.sessionId, status: result.status },
          "in-process webhook returned error status",
        );
      }
    } catch (err) {
      logger.error({ err, sessionId: session.sessionId }, "in-process webhook failed");
    }
    return;
  }

  try {
    await fetch(session.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-gateway-secret": SECRET,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.error({ err, sessionId: session.sessionId }, "webhook failed");
  }
}

function jidToPhone(jid) {
  return jid.split("@")[0]?.split(":")[0] ?? jid;
}

async function startSocket(session) {
  const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    downloadMediaMessage,
  } = await getBaileys();

  ensureAuthDir();
  const authDir = path.join(AUTH_ROOT, session.sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  session.status = "CONNECTING";
  session.lastError = undefined;

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
      await handleIncoming(session, msg, downloadMediaMessage);
    }
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const u of updates) {
      if (!u.key?.id || !u.update?.status) continue;
      const statusMap = {
        2: "SENT",
        3: "DELIVERED",
        4: "READ",
      };
      const status = statusMap[u.update.status];
      if (!status) continue;
      await notifyWebhook(session, "message_status", {
        externalId: u.key.id,
        status,
      });
    }
  });
}

async function handleIncoming(session, msg, downloadMediaMessage) {
  if (msg.key.fromMe) return;
  const remote = msg.key.remoteJid;
  if (!remote || remote.endsWith("@g.us") || remote === "status@broadcast") return;

  const from = jidToPhone(remote);
  const pushName = msg.pushName ?? null;
  let type = "TEXT";
  let body =
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text ??
    msg.message?.imageMessage?.caption ??
    msg.message?.videoMessage?.caption ??
    null;
  let mediaUrl = null;
  let mediaMimeType = null;

  try {
    if (msg.message?.audioMessage) {
      type = "AUDIO";
      const buffer = await downloadMediaMessage(msg, "buffer", {});
      const fileName = `wa_${session.sessionId}_${Date.now()}.ogg`;
      const publicDir = path.join(process.cwd(), "public", "uploads");
      fs.mkdirSync(publicDir, { recursive: true });
      const filePath = path.join(publicDir, fileName);
      fs.writeFileSync(filePath, buffer);
      mediaUrl = `/uploads/${fileName}`;
      mediaMimeType = msg.message.audioMessage.mimetype ?? "audio/ogg";
      body = body ?? "";
    } else if (msg.message?.imageMessage) {
      type = "IMAGE";
    } else if (msg.message?.documentMessage) {
      type = "DOCUMENT";
    }
  } catch (err) {
    logger.warn({ err }, "media download failed");
  }

  await notifyWebhook(session, "message", {
    from,
    pushName,
    type,
    body,
    mediaUrl,
    mediaMimeType,
    externalId: msg.key.id,
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

export const gatewayOps = {
  health() {
    const baileysDir = path.join(
      PROJECT_ROOT,
      "node_modules/@whiskeysockets/baileys",
    );
    return {
      ok: true,
      sessions: sessions.size,
      baileysPath: baileysDir,
      baileysPresent: fs.existsSync(path.join(baileysDir, "package.json")),
    };
  },

  async startSession({ channelId, sessionId, webhookUrl }) {
    if (!channelId || !sessionId || !webhookUrl) {
      throw new Error("channelId, sessionId, webhookUrl required");
    }

    await getBaileys();

    let session = sessions.get(sessionId);
    if (!session) {
      session = { channelId, sessionId, webhookUrl, status: "CONNECTING" };
      sessions.set(sessionId, session);
    } else {
      session.channelId = channelId;
      session.webhookUrl = webhookUrl;
    }
    saveRegistry();

    if (session.status !== "CONNECTED" || !session.sock) {
      void startSocket(session);
    }
    return {
      ok: true,
      status: session.status,
      qrDataUrl: session.qrDataUrl,
      phoneNumber: session.phoneNumber,
    };
  },

  async getStatus(sessionId) {
    const session = sessions.get(sessionId);
    if (!session) throw new Error("Session not found");
    return {
      status: session.status,
      qrDataUrl: session.qrDataUrl,
      phoneNumber: session.phoneNumber,
      lastError: session.lastError,
    };
  },

  async stopSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session?.sock) {
      await session.sock.logout().catch(() => undefined);
      session.sock.end(undefined);
    }
    const authDir = path.join(AUTH_ROOT, sessionId);
    try {
      fs.rmSync(authDir, { recursive: true, force: true });
    } catch {}
    sessions.delete(sessionId);
    saveRegistry();
    return { ok: true };
  },

  async sendText({ sessionId, to, text }) {
    return sendText(sessionId, to, text);
  },

  async sendAudio({ sessionId, to, audioUrl, ptt = true }) {
    return sendAudio(sessionId, to, audioUrl, ptt);
  },
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (req.headers["x-gateway-secret"] !== SECRET && url.pathname !== "/health") {
    return unauthorized(res);
  }

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, gatewayOps.health());
    }

    if (req.method === "POST" && url.pathname === "/sessions/start") {
      const body = await readBody(req);
      const { channelId, sessionId, webhookUrl } = body;
      if (!channelId || !sessionId || !webhookUrl) {
        return json(res, 400, { error: "channelId, sessionId, webhookUrl required" });
      }
      return json(res, 200, await gatewayOps.startSession({ channelId, sessionId, webhookUrl }));
    }

    const statusMatch = url.pathname.match(/^\/sessions\/([^/]+)\/status$/);
    if (req.method === "GET" && statusMatch) {
      if (!sessions.has(statusMatch[1])) {
        return json(res, 404, { error: "Session not found" });
      }
      return json(res, 200, await gatewayOps.getStatus(statusMatch[1]));
    }

    const stopMatch = url.pathname.match(/^\/sessions\/([^/]+)\/stop$/);
    if (req.method === "POST" && stopMatch) {
      return json(res, 200, await gatewayOps.stopSession(stopMatch[1]));
    }

    if (req.method === "POST" && url.pathname === "/messages/text") {
      const body = await readBody(req);
      const result = await gatewayOps.sendText(body);
      return json(res, 200, result);
    }

    if (req.method === "POST" && url.pathname === "/messages/audio") {
      const body = await readBody(req);
      const result = await gatewayOps.sendAudio(body);
      return json(res, 200, result);
    }

    json(res, 404, { error: "Not found" });
  } catch (err) {
    logger.error({ err }, "request failed");
    json(res, 500, { error: err instanceof Error ? err.message : "Internal error" });
  }
});

export async function startGateway() {
  ensureAuthDir();

  try {
    await getBaileys();
    logger.info("Baileys module loaded from project node_modules");
  } catch (error) {
    logger.error({ err: error }, "Baileys load failed at gateway start");
    throw error;
  }

  globalThis.__wasysGateway = gatewayOps;

  return new Promise((resolve) => {
    let settled = false;
    const settle = (listening) => {
      if (settled) return;
      settled = true;
      resumeSessions();
      resolve(listening);
    };

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        logger.warn(`Gateway port ${PORT} already in use — continuing in-process only`);
      } else {
        logger.warn(
          { err },
          `gateway HTTP port ${PORT} unavailable — continuing in-process only`,
        );
      }
      settle(false);
    });
    server.listen(PORT, "127.0.0.1", () => {
      logger.info(`WASYS WhatsApp gateway listening on 127.0.0.1:${PORT}`);
      settle(true);
    });
  });
}

if (process.argv[1] && process.argv[1].endsWith("server.mjs")) {
  void startGateway();
}
