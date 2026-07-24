import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { waGateway } from "@/lib/wa-gateway";
import { sendCloudText } from "@/lib/wa-cloud";

const sendSchema = z.object({
  body: z.string().min(1),
  type: z.enum(["TEXT", "AUDIO"]).default("TEXT"),
  mediaUrl: z.string().optional(),
});

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      contact: true,
      channel: true,
      assignedTo: { select: { id: true, name: true, email: true } },
      tags: { include: { tag: true } },
      // En yeni 200 mesajı al (uzun sohbetlerde son mesajlar kaybolmasın),
      // sonra ekranda kronolojik göstermek için ters çevir.
      messages: { orderBy: { createdAt: "desc" }, take: 200 },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  conversation.messages.reverse();

  if (conversation.unreadCount > 0) {
    await prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }

  return NextResponse.json({ conversation: { ...conversation, unreadCount: 0 } });
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

  try {
    if (conversation.channel.type === "WHATSAPP_QR") {
      if (!conversation.channel.sessionId || conversation.channel.status !== "CONNECTED") {
        return NextResponse.json(
          { error: "WhatsApp kanalı bağlı değil. QR ile bağlanın." },
          { status: 400 },
        );
      }
      if (payload.type === "AUDIO" && payload.mediaUrl) {
        const result = await waGateway.sendAudio({
          sessionId: conversation.channel.sessionId,
          to: conversation.contact.phone,
          audioUrl: payload.mediaUrl,
        });
        externalId = result.externalId;
      } else {
        const result = await waGateway.sendText({
          sessionId: conversation.channel.sessionId,
          to: conversation.contact.phone,
          text: payload.body,
        });
        externalId = result.externalId;
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
    console.error(err);
    status = "FAILED";
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
