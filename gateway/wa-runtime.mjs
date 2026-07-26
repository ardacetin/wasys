import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

/** Deploy doğrulama — UI/log'da bu ID yoksa Hostinger eski gateway dosyasını çalıştırıyordur. */
export const GATEWAY_LOADER_ID = "wa-runtime-2026-07-26f";

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
const LID_MAP_FILE = path.join(DATA_ROOT, "wa-lid-map.json");
const logger = pino({ level: "info" });

/** phoneDigits → @lid JID (iOS / Meta Ads sohbetleri için zorunlu) */
const lidByPhone = new Map();

function loadLidMap() {
  try {
    if (!fs.existsSync(LID_MAP_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(LID_MAP_FILE, "utf8"));
    if (!raw || typeof raw !== "object") return;
    for (const [phone, jid] of Object.entries(raw)) {
      if (phone && typeof jid === "string" && jid.endsWith("@lid")) {
        lidByPhone.set(String(phone).replace(/\D/g, ""), jid);
      }
    }
    logger.info({ count: lidByPhone.size }, "loaded PN→LID map");
  } catch (err) {
    logger.warn({ err }, "failed to load lid map");
  }
}

function saveLidMap() {
  try {
    fs.mkdirSync(DATA_ROOT, { recursive: true });
    const obj = Object.fromEntries(lidByPhone.entries());
    fs.writeFileSync(LID_MAP_FILE, JSON.stringify(obj, null, 2));
  } catch (err) {
    logger.warn({ err }, "failed to persist lid map");
  }
}

function rememberLidMapping(phone, remoteJid) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!digits || !remoteJid || typeof remoteJid !== "string") return;
  if (!remoteJid.endsWith("@lid")) return;
  const prev = lidByPhone.get(digits);
  if (prev === remoteJid) return;
  lidByPhone.set(digits, remoteJid);
  saveLidMap();
}

loadLidMap();

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
      return;
    } catch (err) {
      logger.error({ err, sessionId: session.sessionId }, "in-process webhook failed");
    }
  }

  // Köprü henüz yüklenmediyse aynı süreçteki Next HTTP'ye düş (Hostinger)
  const appPort = Number(process.env.PORT || 3000);
  const candidates = [
    `http://127.0.0.1:${appPort}/api/webhooks/wa-gateway`,
    session.webhookUrl,
  ].filter(Boolean);

  let delivered = false;
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-gateway-secret": SECRET,
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        delivered = true;
        // İlk başarılı HTTP, sonraki olaylar için köprüyü doldurmuş olur
        break;
      }
      logger.warn(
        { event, url, status: res.status },
        "webhook HTTP non-OK",
      );
    } catch (err) {
      logger.warn(
        { err, event, url },
        "webhook HTTP failed",
      );
    }
  }

  if (!delivered) {
    logger.error(
      { event, sessionId: session.sessionId },
      "webhook delivery failed (in-process + HTTP)",
    );
  }
}

function jidToPhone(jid) {
  if (!jid || typeof jid !== "string") return "";
  return jid.split("@")[0]?.split(":")[0] ?? "";
}

/** LID (@lid) veya alternatif alanlardan gerçek telefonu çıkar. */
function resolveSenderPhone(msg) {
  const candidates = [
    msg.key?.senderPn,
    msg.key?.participantPn,
    msg.key?.remoteJidAlt,
    msg.key?.participant,
    msg.key?.remoteJid,
  ];
  for (const jid of candidates) {
    if (!jid || typeof jid !== "string") continue;
    if (jid.endsWith("@lid") || jid.endsWith("@g.us")) continue;
    if (jid === "status@broadcast" || jid.endsWith("@broadcast")) continue;
    if (jid.endsWith("@newsletter")) continue;
    const phone = jidToPhone(jid).replace(/\D/g, "");
    if (phone.length >= 8 && phone.length <= 15) return phone;
  }
  return "";
}

function normalizeUserJid(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.includes("@")) {
    const at = trimmed.lastIndexOf("@");
    const userPart = trimmed.slice(0, at);
    const domain = trimmed.slice(at + 1);
    if (
      domain !== "lid" &&
      domain !== "s.whatsapp.net" &&
      domain !== "hosted" &&
      domain !== "hosted.lid"
    ) {
      return "";
    }
    const user = userPart.split(":")[0];
    if (!user) return "";
    return `${user}@${domain}`;
  }
  const phone = trimmed.replace(/\D/g, "");
  if (phone.length < 8 || phone.length > 15) return "";
  return `${phone}@s.whatsapp.net`;
}

/**
 * Baileys 6.7.x: önce PN (@s.whatsapp.net), sonra bilinen sohbet JID / LID.
 * Yanlış @lid → "gönderildi" görünüp karşıda hiç düşmeme / waiting.
 */
async function resolveOutboundJid(sock, to, preferredJid) {
  const candidates = [];
  const push = (jid) => {
    const n = normalizeUserJid(jid);
    if (n && !candidates.includes(n)) candidates.push(n);
  };

  const phone = String(to ?? preferredJid ?? "")
    .split("@")[0]
    .replace(/\D/g, "");

  // 1) Klasik telefon JID (6.7 için en güvenli ilk deneme)
  if (phone) push(`${phone}@s.whatsapp.net`);

  // 2) Gelen sohbetten bilinen JID
  push(preferredJid);

  // 3) Kalıcı PN→LID
  if (phone) {
    const mapped = lidByPhone.get(phone);
    if (mapped) push(mapped);
  }

  // 4) onWhatsApp
  if (phone) {
    try {
      const results = await sock.onWhatsApp(phone);
      const hit = Array.isArray(results) ? results[0] : null;
      if (hit?.exists === false) {
        throw new Error(`Bu numara WhatsApp’ta yok: ${phone}`);
      }
      if (hit?.exists) {
        if (hit.jid) push(hit.jid);
        if (hit.lid) {
          const lidJid = String(hit.lid).includes("@")
            ? String(hit.lid)
            : `${hit.lid}@lid`;
          push(lidJid);
          rememberLidMapping(phone, lidJid);
        }
      }
    } catch (err) {
      if (err instanceof Error && /WhatsApp’ta yok/.test(err.message)) throw err;
      logger.warn({ err, phone }, "onWhatsApp lookup failed");
    }
  }

  push(to);

  if (!candidates.length) {
    throw new Error("Geçersiz telefon / WhatsApp JID");
  }
  return candidates;
}

/** SERVER_ACK (2+) gelmezse karşı tarafa düşmemiş say. */
function waitForServerAck(sock, messageId, timeoutMs = 10000) {
  if (!messageId) return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        sock.ev.off("messages.update", onUpdate);
      } catch {
        /* ignore */
      }
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    const onUpdate = (updates) => {
      for (const u of updates ?? []) {
        if (u?.key?.id !== messageId) continue;
        const st = u?.update?.status;
        // 2 SERVER_ACK, 3 DELIVERY, 4 READ
        if (typeof st === "number" && st >= 2) {
          finish(true);
          return;
        }
      }
    };
    sock.ev.on("messages.update", onUpdate);
  });
}

async function sendWithJidFallback(session, to, preferredJid, buildContent) {
  const sock = session.sock;
  if (!sock?.sendMessage) {
    throw new Error("WhatsApp soketi hazır değil");
  }

  try {
    await sock.sendPresenceUpdate?.("available");
  } catch {
    /* ignore */
  }

  const jids = await resolveOutboundJid(sock, to, preferredJid);
  let lastError;
  let lastNoAckJid;

  for (const jid of jids) {
    try {
      logger.info(
        { sessionId: session.sessionId, jid, to, loaderId: GATEWAY_LOADER_ID },
        "outbound WhatsApp send attempt",
      );
      const result = await sock.sendMessage(jid, buildContent());
      const externalId = result?.key?.id;
      if (!externalId) {
        throw new Error("sendMessage kimlik (id) döndürmedi");
      }

      const acked = await waitForServerAck(sock, externalId, 10000);
      if (!acked) {
        lastNoAckJid = jid;
        logger.warn(
          { sessionId: session.sessionId, jid, externalId },
          "outbound send got no server ack — trying next jid",
        );
        continue;
      }

      const phone = String(to ?? "")
        .split("@")[0]
        .replace(/\D/g, "");
      if (phone && (jid.endsWith("@lid") || jid.endsWith("@s.whatsapp.net"))) {
        if (jid.endsWith("@lid")) rememberLidMapping(phone, jid);
      }
      logger.info(
        { sessionId: session.sessionId, jid, externalId },
        "outbound WhatsApp send acked",
      );
      return { externalId, jid, acked: true };
    } catch (err) {
      lastError = err;
      logger.warn(
        {
          err,
          sessionId: session.sessionId,
          jid,
          to,
        },
        "outbound send failed for jid — trying next",
      );
    }
  }

  if (lastNoAckJid && !lastError) {
    throw new Error(
      `WhatsApp sunucu onayı gelmedi (son JID: ${lastNoAckJid}). Kanalı Yenile / yeniden QR ile bağlayın.`,
    );
  }

  const detail =
    lastError instanceof Error ? lastError.message : String(lastError ?? "send failed");
  throw new Error(`WhatsApp gönderilemedi: ${detail}`);
}

function unwrapMessageContent(message) {
  if (!message) return null;
  return (
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.viewOnceMessageV2Extension?.message ||
    message.documentWithCaptionMessage?.message ||
    message
  );
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
    markOnlineOnConnect: true,
    keepAliveIntervalMs: 25_000,
    connectTimeoutMs: 60_000,
    retryRequestDelayMs: 500,
    defaultQueryTimeoutMs: 60_000,
    // Yeniden gönderim / decrypt için gerekli; yoksa giden mesajlar "takılı" kalabiliyor
    getMessage: async () => undefined,
    emitOwnEvents: true,
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
    // Baileys: gerçek zamanlı mesajlar çoğu zaman "notify"; geçmiş/senkron "append".
    // Yalnızca notify dinlemek gelen mesajları yutuyordu.
    if (type !== "notify" && type !== "append") return;
    for (const msg of messages) {
      try {
        await handleIncoming(session, msg, downloadMediaMessage);
      } catch (err) {
        logger.error({ err, type }, "handleIncoming failed");
      }
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
  if (msg.key?.fromMe) return;
  const remote = msg.key?.remoteJid;
  if (!remote || remote.endsWith("@g.us") || remote === "status@broadcast") return;
  if (remote.endsWith("@newsletter") || remote.endsWith("@broadcast")) return;

  const from = resolveSenderPhone(msg);
  if (!from) {
    logger.warn(
      {
        sessionId: session.sessionId,
        remoteJid: remote,
        senderPn: msg.key?.senderPn,
      },
      "incoming message skipped — phone unresolved (LID?)",
    );
    return;
  }

  // iOS / Meta Ads: cevap için PN→LID eşlemesini sakla
  rememberLidMapping(from, remote);
  const preferredChatJid =
    normalizeUserJid(remote) ||
    normalizeUserJid(msg.key?.senderPn) ||
    `${from}@s.whatsapp.net`;

  const content = unwrapMessageContent(msg.message);
  if (!content) {
    // protocolMessage / revoke vb. — yoksay
    return;
  }

  const pushName = msg.pushName ?? null;
  let type = "TEXT";
  let body =
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    content.documentMessage?.caption ??
    null;
  let mediaUrl = null;
  let mediaMimeType = null;

  try {
    if (content.audioMessage) {
      type = "AUDIO";
      const buffer = await downloadMediaMessage(msg, "buffer", {});
      const fileName = `wa_${session.sessionId}_${Date.now()}.ogg`;
      const publicDir = path.join(process.cwd(), "public", "uploads");
      fs.mkdirSync(publicDir, { recursive: true });
      const filePath = path.join(publicDir, fileName);
      fs.writeFileSync(filePath, buffer);
      mediaUrl = `/uploads/${fileName}`;
      mediaMimeType = content.audioMessage.mimetype ?? "audio/ogg";
      body = body ?? "";
    } else if (content.imageMessage) {
      type = "IMAGE";
      body = body ?? "";
    } else if (content.documentMessage) {
      type = "DOCUMENT";
      body = body ?? content.documentMessage.fileName ?? "";
    } else if (content.stickerMessage) {
      type = "IMAGE";
      body = body ?? "";
    } else if (content.videoMessage) {
      type = "VIDEO";
      body = body ?? "";
    } else if (!body) {
      logger.info(
        { keys: Object.keys(content), from },
        "incoming non-text content ignored",
      );
      return;
    }
  } catch (err) {
    logger.warn({ err }, "media download failed");
  }

  logger.info(
    { from, type, sessionId: session.sessionId, id: msg.key?.id },
    "incoming WhatsApp message",
  );

  await notifyWebhook(session, "message", {
    from,
    remoteJid: preferredChatJid,
    pushName,
    type,
    body,
    mediaUrl,
    mediaMimeType,
    externalId: msg.key.id,
  });
}

async function ensureConnectedSession(sessionId) {
  let session = sessions.get(sessionId);
  if (session?.sock && session.status === "CONNECTED") return session;

  // Bellekten düşmüş ama auth varsa yeniden ayağa kaldır
  if (!session) {
    const authDir = path.join(AUTH_ROOT, sessionId);
    if (fs.existsSync(path.join(authDir, "creds.json"))) {
      logger.warn({ sessionId }, "session missing in memory — hot-resuming for send");
      let channelId = sessionId;
      let webhookUrl = process.env.WEBHOOK_BASE_URL
        ? `${process.env.WEBHOOK_BASE_URL}/api/webhooks/wa-gateway`
        : `http://127.0.0.1:${process.env.PORT || 3000}/api/webhooks/wa-gateway`;
      try {
        if (fs.existsSync(REGISTRY_FILE)) {
          const entries = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
          const hit = Array.isArray(entries)
            ? entries.find((e) => e?.sessionId === sessionId)
            : null;
          if (hit?.channelId) channelId = hit.channelId;
          if (hit?.webhookUrl) webhookUrl = hit.webhookUrl;
        }
      } catch {
        /* ignore */
      }
      session = {
        channelId,
        sessionId,
        webhookUrl,
        status: "CONNECTING",
      };
      sessions.set(sessionId, session);
      await startSocket(session);
    }
  }

  if (session?.sock && session.status === "CONNECTED") return session;

  // Kısa süre CONNECTING ise open olmasını bekle
  if (session && (session.status === "CONNECTING" || session.status === "QR_PENDING")) {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      if (session.sock && session.status === "CONNECTED") return session;
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  if (session && session.status !== "CONNECTED") {
    throw new Error(
      `WhatsApp oturumu bağlı değil (durum: ${session.status}). Kanallar’dan yeniden bağlanın.`,
    );
  }
  throw new Error(
    "WhatsApp oturumu bellekten düşmüş. Kanallar’da QR ile bir kez Yenile / Bağlan yapın veya uygulamayı Restart edin.",
  );
}

async function sendText(sessionId, to, text, jid) {
  const session = await ensureConnectedSession(sessionId);
  return sendWithJidFallback(session, to, jid, () => ({ text }));
}

async function sendAudio(sessionId, to, audioUrl, ptt = true, jid) {
  const session = await ensureConnectedSession(sessionId);
  const localPath = audioUrl.startsWith("/")
    ? path.join(process.cwd(), "public", audioUrl.replace(/^\//, ""))
    : audioUrl;
  const buffer = fs.readFileSync(localPath);
  return sendWithJidFallback(session, to, jid, () => ({
    audio: buffer,
    mimetype: "audio/ogg; codecs=opus",
    ptt,
  }));
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
    const sessionSummary = [...sessions.values()].map((s) => ({
      sessionId: s.sessionId,
      status: s.status,
      hasSock: Boolean(s.sock),
      phoneNumber: s.phoneNumber ?? null,
    }));
    return {
      ok: true,
      loaderId: GATEWAY_LOADER_ID,
      sessions: sessions.size,
      connectedSessions: sessionSummary.filter((s) => s.status === "CONNECTED").length,
      sessionSummary,
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

  async sendText({ sessionId, to, text, jid }) {
    return sendText(sessionId, to, text, jid);
  },

  async sendAudio({ sessionId, to, audioUrl, ptt = true, jid }) {
    return sendAudio(sessionId, to, audioUrl, ptt, jid);
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

  // İkinci import boş sessions Map ile global'i ezmesin (gönderim kırılıyor,
  // gelen webhook eski sokette kalıyor).
  if (
    globalThis.__wasysGateway &&
    globalThis.__wasysGatewayLoaderId &&
    globalThis.__wasysGateway !== gatewayOps
  ) {
    logger.warn(
      {
        existing: globalThis.__wasysGatewayLoaderId,
        incoming: GATEWAY_LOADER_ID,
      },
      "gateway already bound — keeping existing ops (skip overwrite)",
    );
    return false;
  }

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
