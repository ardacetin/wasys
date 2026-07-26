/**
 * WhatsApp gateway olay işleyicisi.
 *
 * Bu mantık eskiden yalnızca /api/webhooks/wa-gateway route'unda yaşıyordu.
 * Gateway artık aynı Node sürecinde çalıştığı için (Hostinger tek süreç),
 * olaylar HTTP yerine doğrudan bu fonksiyonla da işlenebilir: modül
 * yüklendiğinde kendini globalThis.__wasysGatewayWebhook olarak kaydeder ve
 * gateway/server.mjs notifyWebhook() önce bu kaydı dener.
 */
import { prisma } from "@/lib/db";
import { applyAssignmentRules, loadConversationTagIds } from "@/lib/assignment";
import { runAutoReplies } from "@/lib/auto-reply";
import {
  cancelDisconnectAlert,
  scheduleDisconnectAlert,
} from "@/lib/disconnect-alert";
import { waGateway } from "@/lib/wa-gateway";

type AutoReplyChannel = { id: string; sessionId: string | null };

/** LID id'si telefon alanına yazılmış kayıtlarda gönderim için kullanılmaz. */
function dialablePhone(...candidates: string[]): string {
  for (const raw of candidates) {
    const p = String(raw ?? "").replace(/\D/g, "");
    if (p.length >= 10 && p.length <= 13) return p;
  }
  return "";
}

export type GatewayWebhookResult = {
  status: number;
  body: Record<string, unknown>;
};

async function sendAutoReply(
  channel: AutoReplyChannel,
  conversationId: string,
  phone: string,
  text: string,
  jid?: string | null,
) {
  if (!channel.sessionId) return;
  try {
    const result = await waGateway.sendText({
      sessionId: channel.sessionId,
      channelId: channel.id,
      to: phone,
      text,
      jid: jid ?? undefined,
    });
    await prisma.message.create({
      data: {
        conversationId,
        direction: "OUTBOUND",
        type: "TEXT",
        status: "SENT",
        body: text,
        externalId: result.externalId ?? null,
      },
    });
  } catch (error) {
    const detail =
      error instanceof Error
        ? { message: error.message, stack: error.stack, to: phone, jid }
        : { error: String(error), to: phone, jid };
    console.error("[WASYS auto-reply] otomatik mesaj gönderilemedi", detail);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleGatewayEvent(payload: any): Promise<GatewayWebhookResult> {
  const { event, channelId, sessionId } = payload;

  // Isınma/ayakta-mı kontrolü: server.js açılışta bu olayı göndererek modülün
  // yüklenmesini (ve in-process kaydın oluşmasını) garanti eder.
  if (event === "ping") {
    return { status: 200, body: { ok: true } };
  }

  const channel = await prisma.channel.findFirst({
    where: {
      OR: [{ id: channelId }, { sessionId }],
    },
  });

  if (!channel) {
    return { status: 404, body: { error: "Channel not found" } };
  }

  if (event === "qr") {
    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: "QR_PENDING",
        qrData: payload.qrDataUrl ?? null,
      },
    });
    return { status: 200, body: { ok: true } };
  }

  if (event === "connected") {
    cancelDisconnectAlert(channel.id);
    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: "CONNECTED",
        qrData: null,
        phoneNumber: payload.phoneNumber ?? channel.phoneNumber,
        connectedAt: new Date(),
        lastError: null,
      },
    });
    return { status: 200, body: { ok: true } };
  }

  if (event === "disconnected") {
    const wasConnected = channel.status === "CONNECTED";
    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: "DISCONNECTED",
        qrData: null,
      },
    });
    // Kısa kopmalarda spam olmasın: gecikmeli uyarı; yeniden bağlanırsa iptal
    if (wasConnected) {
      scheduleDisconnectAlert(channel.id, {
        urgent: payload.shouldReconnect === false,
      });
    }
    return { status: 200, body: { ok: true } };
  }

  if (event === "message_status") {
    if (payload.externalId && payload.status) {
      await prisma.message.updateMany({
        where: { externalId: payload.externalId },
        data: { status: payload.status },
      });
    }
    return { status: 200, body: { ok: true } };
  }

  if (event === "message") {
    const phone = String(payload.from ?? "").replace(/\D/g, "");
    const remoteJid =
      typeof payload.remoteJid === "string" && payload.remoteJid.includes("@")
        ? payload.remoteJid
        : null;
    const lidUser =
      remoteJid?.endsWith("@lid") || remoteJid?.endsWith("@hosted.lid")
        ? remoteJid.split("@")[0] ?? ""
        : "";

    // LID id'sini telefon sanan eski kayıtları da bul / düzelt
    let contact = phone
      ? await prisma.contact.findUnique({
          where: {
            organizationId_phone: {
              organizationId: channel.organizationId,
              phone,
            },
          },
        })
      : null;

    if (!contact && remoteJid) {
      contact = await prisma.contact.findFirst({
        where: {
          organizationId: channel.organizationId,
          waJid: remoteJid,
        },
      });
    }

    if (!contact && lidUser) {
      contact = await prisma.contact.findFirst({
        where: {
          organizationId: channel.organizationId,
          phone: lidUser,
        },
      });
    }

    if (!contact) {
      if (!phone || phone.length > 13) {
        // Gerçek numara yok — sohbet açma (gönderim de çalışmaz)
        return { status: 200, body: { ok: true, skipped: "no-phone" } };
      }
      contact = await prisma.contact.create({
        data: {
          organizationId: channel.organizationId,
          phone,
          name: payload.pushName ?? phone,
          ...(remoteJid ? { waJid: remoteJid } : {}),
        },
      });
    } else {
      const patch: { name?: string; waJid?: string; phone?: string } = {};
      if (payload.pushName && !contact.name) patch.name = payload.pushName;
      if (remoteJid && contact.waJid !== remoteJid) patch.waJid = remoteJid;
      // Telefon alanı LID id ise gerçek numarayla düzelt
      if (
        phone &&
        phone.length <= 13 &&
        contact.phone !== phone &&
        (contact.phone === lidUser || contact.phone.length > 13)
      ) {
        patch.phone = phone;
      }
      if (Object.keys(patch).length) {
        try {
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: patch,
          });
        } catch {
          // unique çakışması — waJid güncellemesi yeterli
          if (patch.waJid || patch.name) {
            contact = await prisma.contact.update({
              where: { id: contact.id },
              data: {
                ...(patch.name ? { name: patch.name } : {}),
                ...(patch.waJid ? { waJid: patch.waJid } : {}),
              },
            });
          }
        }
      }
    }

    let conversation = await prisma.conversation.findUnique({
      where: {
        channelId_contactId: {
          channelId: channel.id,
          contactId: contact.id,
        },
      },
    });

    const isNewConversation = !conversation;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          organizationId: channel.organizationId,
          channelId: channel.id,
          contactId: contact.id,
          lastMessageAt: new Date(),
          lastMessagePreview: String(payload.body ?? "").slice(0, 140),
          unreadCount: 1,
        },
      });
    } else {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: String(payload.body ?? "").slice(0, 140),
          unreadCount: { increment: 1 },
        },
      });
    }

    if (payload.externalId) {
      const existing = await prisma.message.findFirst({
        where: { externalId: payload.externalId },
      });
      if (existing) return { status: 200, body: { ok: true } };
    }

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "INBOUND",
        type: payload.type ?? "TEXT",
        status: "DELIVERED",
        body: payload.body ?? null,
        mediaUrl: payload.mediaUrl ?? null,
        mediaMimeType: payload.mediaMimeType ?? null,
        externalId: payload.externalId ?? null,
      },
    });

    const tagIds = await loadConversationTagIds(conversation.id);
    const assignToId = await applyAssignmentRules({
      organizationId: channel.organizationId,
      channelId: channel.id,
      messageBody: payload.body,
      isNewConversation,
      currentAssignedToId: conversation.assignedToId,
      tagIds,
    });

    if (assignToId) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { assignedToId: assignToId },
      });
    }

    const autoReplyPhone = dialablePhone(phone, contact.phone);
    const autoReplyJid = remoteJid ?? contact.waJid;
    const autoReplyCtx = {
      organizationId: channel.organizationId,
      conversationId: conversation.id,
      contact,
      isNewConversation,
      channel,
      autoReplyPhone,
      autoReplyJid,
    };
    setImmediate(() => {
      void runAutoReplies({
        organizationId: autoReplyCtx.organizationId,
        conversationId: autoReplyCtx.conversationId,
        contact: autoReplyCtx.contact,
        isNewConversation: autoReplyCtx.isNewConversation,
        send: (text) =>
          sendAutoReply(
            autoReplyCtx.channel,
            autoReplyCtx.conversationId,
            autoReplyCtx.autoReplyPhone,
            text,
            autoReplyCtx.autoReplyJid,
          ),
      }).catch((err) => {
        console.error("[WASYS auto-reply]", err);
      });
    });

    return { status: 200, body: { ok: true } };
  }

  return { status: 200, body: { ok: true } };
}

// Gateway aynı süreçte çalışırken olayları HTTP olmadan iletebilsin diye
// modül yüklenir yüklenmez in-process köprüyü kaydet.
const globalBridge = globalThis as {
  __wasysGatewayWebhook?: (payload: unknown) => Promise<GatewayWebhookResult>;
};
globalBridge.__wasysGatewayWebhook = (payload) => handleGatewayEvent(payload);
