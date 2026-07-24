import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applyAssignmentRules } from "@/lib/assignment";
import { analyzeIntent } from "@/lib/intent-ai";
import { hasFeature } from "@/lib/plans";

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
    await prisma.channel.update({
      where: { id: channel.id },
      data: {
        status: "DISCONNECTED",
        qrData: null,
      },
    });
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
      select: { plan: true },
    });

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
