import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applyAssignmentRules } from "@/lib/assignment";
import {
  anyAgentOnline,
  awayMessageRecentlySent,
  fillAutoMessage,
} from "@/lib/auto-reply";
import { analyzeIntent } from "@/lib/intent-ai";
import { sendMail } from "@/lib/mailer";
import { hasFeature } from "@/lib/plans";
import { waGateway } from "@/lib/wa-gateway";

type AutoReplyChannel = { sessionId: string | null };

async function sendAutoReply(
  channel: AutoReplyChannel,
  conversationId: string,
  phone: string,
  text: string,
) {
  if (!channel.sessionId) return;
  try {
    const result = await waGateway.sendText({
      sessionId: channel.sessionId,
      to: phone,
      text,
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
    console.error("[WASYS auto-reply] otomatik mesaj gönderilemedi", error);
  }
}

async function notifyDisconnect(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { organization: { select: { name: true, alertEmail: true } } },
  });
  if (!channel) return;

  let recipients: string[] = [];
  if (channel.organization.alertEmail?.trim()) {
    recipients = [channel.organization.alertEmail.trim()];
  } else {
    const admins = await prisma.user.findMany({
      where: {
        organizationId: channel.organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
      select: { email: true },
    });
    recipients = admins.map((a) => a.email);
  }
  if (!recipients.length) return;

  const label = channel.phoneNumber
    ? `${channel.name} (${channel.phoneNumber})`
    : channel.name;
  await sendMail({
    to: recipients,
    subject: `WASYS uyarı: ${label} WhatsApp bağlantısı koptu`,
    text: [
      `Merhaba,`,
      ``,
      `${channel.organization.name} hesabınızdaki "${label}" kanalının WhatsApp bağlantısı kesildi.`,
      ``,
      `Mesaj alışverişinin durmaması için panele girip kanalı yeniden bağlayın:`,
      `https://wasys.pro/settings/channels`,
      ``,
      `QR bağlantısı: Kanallar sayfasından "Bağlan" deyip telefonunuzla QR kodu okutun.`,
      ``,
      `WASYS`,
    ].join("\n"),
  });
}

function authorized(req: Request) {
  return req.headers.get("x-gateway-secret") === (process.env.GATEWAY_SECRET ?? "wasys-gateway-secret");
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json();
  const { event, channelId, sessionId } = payload;

  const channel = await prisma.channel.findFirst({
    where: {
      OR: [{ id: channelId }, { sessionId }],
    },
  });

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  if (event === "qr") {
    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: "QR_PENDING",
        qrData: payload.qrDataUrl ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (event === "connected") {
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
    return NextResponse.json({ ok: true });
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
    // Gerçek kopmalarda (bağlıyken düşme) yöneticilere e-posta uyarısı gönder
    if (wasConnected) {
      notifyDisconnect(channel.id).catch((error) =>
        console.error("[WASYS] bağlantı kopma e-postası gönderilemedi", error),
      );
    }
    return NextResponse.json({ ok: true });
  }

  if (event === "message_status") {
    if (payload.externalId && payload.status) {
      await prisma.message.updateMany({
        where: { externalId: payload.externalId },
        data: { status: payload.status },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (event === "message") {
    const phone = String(payload.from ?? "").replace(/\D/g, "");
    if (!phone) return NextResponse.json({ ok: true });

    let contact = await prisma.contact.findUnique({
      where: {
        organizationId_phone: {
          organizationId: channel.organizationId,
          phone,
        },
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          organizationId: channel.organizationId,
          phone,
          name: payload.pushName ?? phone,
        },
      });
    } else if (payload.pushName && !contact.name) {
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: { name: payload.pushName },
      });
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
      if (existing) return NextResponse.json({ ok: true });
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

    const assignToId = await applyAssignmentRules({
      organizationId: channel.organizationId,
      channelId: channel.id,
      messageBody: payload.body,
      isNewConversation,
      currentAssignedToId: conversation.assignedToId,
    });

    if (assignToId) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { assignedToId: assignToId },
      });
    }

    const org = await prisma.organization.findUnique({
      where: { id: channel.organizationId },
      select: {
        plan: true,
        welcomeMessageEnabled: true,
        welcomeMessage: true,
        awayMessageEnabled: true,
        awayMessage: true,
      },
    });

    // Otomatik karşılama: yeni sohbetin ilk mesajına otomatik yanıt
    if (
      org?.welcomeMessageEnabled &&
      org.welcomeMessage?.trim() &&
      isNewConversation
    ) {
      await sendAutoReply(
        channel,
        conversation.id,
        contact.phone,
        fillAutoMessage(org.welcomeMessage.trim(), contact),
      );
    }

    // Meşgul mesajı: panelde aktif kimse yoksa (spam engelli)
    if (org?.awayMessageEnabled && org.awayMessage?.trim()) {
      const awayText = fillAutoMessage(org.awayMessage.trim(), contact);
      const online = await anyAgentOnline(channel.organizationId);
      if (!online && !(await awayMessageRecentlySent(conversation.id, awayText))) {
        await sendAutoReply(channel, conversation.id, contact.phone, awayText);
      }
    }

    if (org && hasFeature(org.plan, "intentAi")) {
      const recent = await prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
        take: 50,
        select: { direction: true, body: true },
      });
      const result = analyzeIntent(recent);
      await prisma.intentSuggestion.create({
        data: {
          conversationId: conversation.id,
          intent: result.intent,
          confidence: result.confidence,
          summary: result.summary,
          suggestions: JSON.stringify(result.suggestions),
        },
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
