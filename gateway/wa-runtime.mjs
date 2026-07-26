import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Deploy doğrulama — UI/log'da bu ID yoksa Hostinger eski gateway dosyasını çalıştırıyordur. */
export const GATEWAY_LOADER_ID = "wa-runtime-2026-07-26c";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveProjectRoot() {
  const roots = [
    path.resolve(__dirname, ".."),
    process.cwd(),
    path.resolve(process.cwd(), ".."),
  ];
  for (const root of roots) {
    const markers = [
      path.join(root, "node_modules/@whiskeysockets/baileys/lib/index.js"),
      path.join(root, "gateway/vendor/baileys/lib/index.js"),
      path.join(root, "package.json"),
    ];
    if (markers.some((marker) => fs.existsSync(marker))) return root;
  }
  return path.resolve(__dirname, "..");
}

const PROJECT_ROOT = resolveProjectRoot();

/**
 * Hostinger'da gateway/ altından bare ESM import (qrcode/pino/baileys) sık
 * bozuluyor. createRequire(projectRoot/package.json) ile mutlak çözümle.
 */
const requireFromRoot = createRequire(path.join(PROJECT_ROOT, "package.json"));

function requireDependency(name, relativeEntry) {
  const absolute = path.join(PROJECT_ROOT, "node_modules", relativeEntry);
  if (fs.existsSync(absolute)) {
    return requireFromRoot(absolute);
  }
  try {
    return requireFromRoot(name);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[${GATEWAY_LOADER_ID}] ${name} yok (${absolute}). ` +
        `SSH: cd ~/domains/wasys.pro/nodejs && npm install ${name} --omit=dev --legacy-peer-deps && Restart. Detay: ${detail}`,
    );
  }
}

const qrcode = requireDependency("qrcode", "qrcode/lib/index.js");
const pino = requireDependency("pino", "pino/pino.js");

/**
 * Hostinger'da bare `@whiskeysockets/baileys` import'u sık bozuluyor / eski
 * gateway/server.mjs kalabiliyor. Paket adını HİÇ kullanma — yalnızca file:// .
 */
async function loadBaileys() {
  // Önce node_modules — bağımlılıklar (protobufjs) orada hoist edilir.
  // vendor yolu yedek (paket budanmışsa).
  const candidates = [
    path.join(
      PROJECT_ROOT,
      "node_modules/@whiskeysockets/baileys/lib/index.js",
    ),
    path.join(__dirname, "vendor/baileys/lib/index.js"),
    path.join(PROJECT_ROOT, "gateway/vendor/baileys/lib/index.js"),
  ];

  const existing = candidates.filter((entry) => fs.existsSync(entry));
  if (existing.length === 0) {
    throw new Error(
      `[${GATEWAY_LOADER_ID}] Baileys dosyası yok. Denenen: ${candidates.join(" | ")}. ` +
        `SSH: cd ~/domains/wasys.pro/nodejs && npm install @whiskeysockets/baileys@6.7.22 --omit=dev --legacy-peer-deps && node scripts/ensure-baileys.cjs && panelden Restart. ` +
        `cwd=${process.cwd()} root=${PROJECT_ROOT}`,
    );
  }

  const errors = [];
  for (const entry of existing) {
    try {
      const mod = await import(pathToFileURL(entry).href);
      console.log(`[WASYS] Baileys yüklendi (${GATEWAY_LOADER_ID}): ${entry}`);
      return mod;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      errors.push(`${entry} => ${detail}`);
    }
  }

  throw new Error(
    `[${GATEWAY_LOADER_ID}] Baileys dosyası var ama yüklenemedi. ${errors.join(" || ")}`,
  );
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
 * @property {boolean=} intentionalStop
 * @property {number=} reconnectAttempt
 * @property {ReturnType<typeof setTimeout>=} reconnectTimer
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

function clearReconnectTimer(session) {
  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = undefined;
  }
}

function endSocketQuietly(sock) {
  if (!sock) return;
  try {
    sock.ev?.removeAllListeners?.();
  } catch {
    /* ignore */
  }
  try {
    sock.end?.(undefined);
  } catch {
    /* ignore */
  }
}

async function startSocket(session) {
  const {
    makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    downloadMediaMessage,
  } = await getBaileys();

  // Çift socket = WhatsApp'ta conflict / hızlı kopma
  clearReconnectTimer(session);
  if (session.sock) {
    endSocketQuietly(session.sock);
    session.sock = null;
  }

  ensureAuthDir();
  const authDir = path.join(AUTH_ROOT, session.sessionId);
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  session.status = "CONNECTING";
  session.lastError = undefined;
  session.intentionalStop = false;

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
    // Gerçekçi tarayıcı kimliği — özel "WASYS" etiketi bazen daha çabuk düşürülür
    browser: ["Ubuntu", "Chrome", "22.04.4"],
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    keepAliveIntervalMs: 25_000,
    connectTimeoutMs: 60_000,
    retryRequestDelayMs: 500,
    defaultQueryTimeoutMs: 60_000,
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
      session.reconnectAttempt = 0;
      session.phoneNumber = sock.user?.id ? jidToPhone(sock.user.id) : undefined;
      saveRegistry();
      logger.info(
        { sessionId: session.sessionId, phone: session.phoneNumber },
        "WhatsApp connection open",
      );
      await notifyWebhook(session, "connected", {
        status: session.status,
        phoneNumber: session.phoneNumber,
      });
    }

    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode;
      const errMsg = lastDisconnect?.error?.message ?? String(lastDisconnect?.error ?? "");
      session.qrDataUrl = undefined;
      session.sock = null;

      if (session.intentionalStop) {
        session.status = "DISCONNECTED";
        session.lastError = undefined;
        return;
      }

      const fatal =
        code === DisconnectReason.loggedOut ||
        code === DisconnectReason.connectionReplaced ||
        code === DisconnectReason.badSession ||
        code === DisconnectReason.multideviceMismatch ||
        code === DisconnectReason.forbidden;

      if (fatal) {
        session.status = "DISCONNECTED";
        session.lastError =
          code === DisconnectReason.connectionReplaced
            ? "Bu numara başka bir yerde bağlandı (WhatsApp Web / başka cihaz). Tek oturum kullanın."
            : code === DisconnectReason.loggedOut
              ? "WhatsApp oturumu telefon üzerinden kapatıldı. Yeniden QR tarayın."
              : `Bağlantı sonlandı (kod ${code}). Yeniden QR gerekebilir.`;

        logger.warn(
          { sessionId: session.sessionId, code, errMsg },
          "WhatsApp fatal disconnect",
        );

        await notifyWebhook(session, "disconnected", {
          status: session.status,
          code,
          shouldReconnect: false,
          reason: session.lastError,
        });

        if (
          code === DisconnectReason.loggedOut ||
          code === DisconnectReason.badSession
        ) {
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch {
            /* ignore */
          }
          sessions.delete(session.sessionId);
          saveRegistry();
        }
        return;
      }

      // Kısa kopma: UI'yi DISCONNECTED yapmadan yeniden bağlan
      session.reconnectAttempt = (session.reconnectAttempt ?? 0) + 1;
      const attempt = session.reconnectAttempt;
      const delay = Math.min(60_000, 1_500 * 2 ** Math.min(attempt - 1, 5));
      session.status = "CONNECTING";
      session.lastError = `Yeniden bağlanılıyor… (deneme ${attempt}, kod ${code ?? "?"})`;

      logger.warn(
        { sessionId: session.sessionId, code, attempt, delay, errMsg },
        "WhatsApp reconnect scheduled",
      );

      // İlk 2 kısa kopmada mail/spam tetikleme; sonra bildir
      if (attempt >= 3) {
        await notifyWebhook(session, "disconnected", {
          status: "CONNECTING",
          code,
          shouldReconnect: true,
          reason: session.lastError,
        });
      }

      clearReconnectTimer(session);
      session.reconnectTimer = setTimeout(() => {
        void startSocket(session);
      }, delay);
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
    const vendorEntry = path.join(__dirname, "vendor/baileys/lib/index.js");
    const nmEntry = path.join(
      PROJECT_ROOT,
      "node_modules/@whiskeysockets/baileys/lib/index.js",
    );
    const baileysPath = fs.existsSync(vendorEntry)
      ? path.dirname(path.dirname(vendorEntry))
      : path.dirname(path.dirname(nmEntry));
    return {
      ok: true,
      loaderId: GATEWAY_LOADER_ID,
      sessions: sessions.size,
      baileysPath,
      baileysPresent:
        fs.existsSync(vendorEntry) || fs.existsSync(nmEntry),
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
    if (session) {
      session.intentionalStop = true;
      clearReconnectTimer(session);
    }
    if (session?.sock) {
      await session.sock.logout().catch(() => undefined);
      endSocketQuietly(session.sock);
      session.sock = null;
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

  // Ops'u hemen kaydet — site boot'u Baileys yüklemesini beklememeli.
  // İlk QR / session start getBaileys() ile lazy yükler.
  globalThis.__wasysGateway = gatewayOps;
  globalThis.__wasysGatewayLoaderId = GATEWAY_LOADER_ID;

  void getBaileys()
    .then(() => {
      logger.info({ loaderId: GATEWAY_LOADER_ID }, "Baileys module loaded (lazy)");
    })
    .catch((error) => {
      logger.error(
        { err: error, loaderId: GATEWAY_LOADER_ID },
        "Baileys preload failed (QR connect will retry)",
      );
    });

  return new Promise((resolve) => {
    let settled = false;
    const settle = (listening) => {
      if (settled) return;
      settled = true;
      clearTimeout(failSafe);
      // Session resume Baileys ister; boot'u bloklamadan arka planda dene.
      setImmediate(() => {
        try {
          resumeSessions();
        } catch (err) {
          logger.warn({ err }, "resumeSessions failed");
        }
      });
      resolve(listening);
    };

    const failSafe = setTimeout(() => {
      logger.warn(
        `Gateway HTTP listen timeout on :${PORT} — continuing in-process only`,
      );
      settle(false);
    }, 3000);

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

if (process.argv[1] && /wa-runtime\.mjs$/.test(process.argv[1])) {
  void startGateway();
}
