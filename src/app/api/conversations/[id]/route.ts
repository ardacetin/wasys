import type { ChannelStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { waGateway } from "@/lib/wa-gateway";
import { sendCloudText } from "@/lib/wa-cloud";
import {
  canSendWhatsAppQrContact,
  explainInvalidSendPhone,
  normalizeWhatsAppPhone,
} from "@/lib/whatsapp-phone";

const sendSchema = z.object({
  body: z.string().min(1),
  type: z.enum(["TEXT", "AUDIO"]).default("TEXT"),
  mediaUrl: z.string().optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const sinceRaw = searchParams.get("since");
  const markRead = searchParams.get("markRead") !== "0";

  // Hafif poll: yalnızca yeni mesajlar (tam sohbet yerine)
  if (sinceRaw) {
    const since = new Date(sinceRaw);
    if (Number.isNaN(since.getTime())) {
      return NextResponse.json({ error: "Geçersiz since" }, { status: 400 });
    }

    const owned = await prisma.conversation.findFirst({
      where: { id, organizationId: session.user.organizationId },
      select: { id: true, unreadCount: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId: id,
        createdAt: { gt: since },
      },
      orderBy: { createdAt: "asc" },
      take: 80,
      select: {
        id: true,
        direction: true,
        type: true,
        status: true,
        body: true,
        mediaUrl: true,
        createdAt: true,
      },
    });

    if (markRead && owned.unreadCount > 0) {
      await prisma.conversation.update({
        where: { id },
        data: { unreadCount: 0 },
      });
    }

    return NextResponse.json({
      messages,
      serverTime: new Date().toISOString(),
    });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: {
      id: true,
      lastMessageAt: true,
      lastMessagePreview: true,
      unreadCount: true,
      assignedToId: true,
      contact: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          waJid: true,
        },
      },
      channel: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          sessionId: true,
        },
      },
      assignedTo: { select: { id: true, name: true, email: true } },
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
      // En yeni 120 mesaj — panel poll'u için yeterli; daha hafif payload
      messages: {
        orderBy: { createdAt: "desc" },
        take: 120,
        select: {
          id: true,
          direction: true,
          type: true,
          status: true,
          body: true,
          mediaUrl: true,
          createdAt: true,
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  conversation.messages.reverse();

  if (markRead && conversation.unreadCount > 0) {
    await prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }

  return NextResponse.json({
    conversation: { ...conversation, unreadCount: 0 },
  });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const payload = sendSchema.parse(await req.json());

  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: { contact: true, channel: true },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let externalId: string | undefined;
  let status: "SENT" | "FAILED" | "PENDING" = "PENDING";
  let sendError: string | undefined;
  const preferredJid = conversation.contact.waJid ?? undefined;

  const sendPhone = normalizeWhatsAppPhone(conversation.contact.phone);

  try {
    if (conversation.channel.type === "WHATSAPP_QR") {
      if (!conversation.channel.sessionId || conversation.channel.status !== "CONNECTED") {
        return NextResponse.json(
          { error: "WhatsApp kanalı bağlı değil. QR ile bağlanın." },
          { status: 400 },
        );
      }
      if (!canSendWhatsAppQrContact(conversation.contact)) {
        return NextResponse.json(
          { error: explainInvalidSendPhone(conversation.contact.phone) },
          { status: 400 },
        );
      }

      let activeSessionId = conversation.channel.sessionId;

      try {
        const live = await waGateway.getChannelStatus(
          conversation.channel.sessionId,
          conversation.channel.id,
        );
        if (live.status !== "CONNECTED") {
          await prisma.channel.update({
            where: { id: conversation.channel.id },
            data: {
              status: live.status as ChannelStatus,
              lastError: live.lastError ?? null,
            },
          }).catch(() => undefined);
          return NextResponse.json(
            {
              error: `WhatsApp şu an bağlı değil (${live.status}). Ayarlar → Kanallar’dan yeniden bağlanın.`,
            },
            { status: 503 },
          );
        }
        if (live.sessionId && live.sessionId !== conversation.channel.sessionId) {
          activeSessionId = live.sessionId;
          await prisma.channel.update({
            where: { id: conversation.channel.id },
            data: { sessionId: live.sessionId },
          }).catch(() => undefined);
        }
      } catch {
        return NextResponse.json(
          {
            error:
              "WhatsApp oturumu sunucuda bulunamadı. Kanallar’dan QR ile yeniden bağlanın veya uygulamayı yeniden başlatın.",
          },
          { status: 503 },
        );
      }

      const sendPayload = {
        sessionId: activeSessionId,
        channelId: conversation.channel.id,
        to: sendPhone ?? "",
        jid: preferredJid,
      };

      if (payload.type === "AUDIO" && payload.mediaUrl) {
        const result = await waGateway.sendAudio({
          ...sendPayload,
          audioUrl: payload.mediaUrl,
        });
        externalId = result.externalId;
        if (!externalId) {
          throw new Error("WhatsApp mesaj kimliği alınamadı");
        }
        if (result.jid && result.jid !== preferredJid) {
          await prisma.contact.update({
            where: { id: conversation.contact.id },
            data: { waJid: result.jid },
          }).catch(() => undefined);
        }
      } else {
        const result = await waGateway.sendText({
          ...sendPayload,
          text: payload.body,
        });
        externalId = result.externalId;
        if (!externalId) {
          throw new Error("WhatsApp mesaj kimliği alınamadı");
        }
        if (result.jid && result.jid !== preferredJid) {
          await prisma.contact.update({
            where: { id: conversation.contact.id },
            data: { waJid: result.jid },
          }).catch(() => undefined);
        }
      }
      status = "SENT";
    } else if (conversation.channel.type === "WHATSAPP_CLOUD") {
      if (!conversation.channel.metaPhoneId || !conversation.channel.metaToken) {
        return NextResponse.json({ error: "Cloud API ayarları eksik" }, { status: 400 });
      }
      const result = await sendCloudText({
        phoneNumberId: conversation.channel.metaPhoneId,
        accessToken: conversation.channel.metaToken,
        to: conversation.contact.phone,
        text: payload.body,
      });
      externalId = result.externalId;
      status = "SENT";
    }
  } catch (err) {
    console.error("[WASYS] outbound send failed", {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      conversationId: conversation.id,
      to: sendPhone,
      jid: preferredJid,
      channelSessionId: conversation.channel.sessionId,
      channelStatus: conversation.channel.status,
    });
    status = "FAILED";
    sendError = err instanceof Error ? err.message : "Mesaj gönderilemedi";
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      type: payload.type,
      status,
      body: payload.body,
      mediaUrl: payload.mediaUrl,
      externalId,
      sentById: session.user.id,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: payload.body.slice(0, 140),
      unreadCount: 0,
    },
  });

  if (status === "FAILED") {
    return NextResponse.json(
      { message, error: sendError ?? "Mesaj gönderilemedi" },
      { status: 502 },
    );
  }

  return NextResponse.json({ message });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await req.json();

  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (body.assignedToId !== undefined) {
    await prisma.conversation.update({
      where: { id },
      data: { assignedToId: body.assignedToId || null },
    });
  }

  if (Array.isArray(body.tagIds)) {
    await prisma.conversationTag.deleteMany({ where: { conversationId: id } });
    if (body.tagIds.length) {
      await prisma.conversationTag.createMany({
        data: body.tagIds.map((tagId: string) => ({ conversationId: id, tagId })),
      });
    }
  }

  return NextResponse.json({ ok: true });
}
