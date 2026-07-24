import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { waGateway } from "@/lib/wa-gateway";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const channel = await prisma.channel.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });

  if (!channel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (channel.type !== "WHATSAPP_QR") {
    return NextResponse.json({ error: "Bu kanal QR bağlantısı desteklemiyor" }, { status: 400 });
  }

  const sessionId = channel.sessionId ?? `sess_${channel.id}`;
  const webhookUrl = `${process.env.WEBHOOK_BASE_URL ?? "http://localhost:3000"}/api/webhooks/wa-gateway`;

  await prisma.channel.update({
    where: { id },
    data: { sessionId, status: "CONNECTING", lastError: null },
  });

  try {
    const result = await waGateway.startSession({
      channelId: channel.id,
      sessionId,
      webhookUrl,
    });

    const updated = await prisma.channel.update({
      where: { id },
      data: {
        status: result.status === "QR_PENDING" ? "QR_PENDING" : "CONNECTING",
        qrData: result.qrDataUrl ?? null,
      },
    });

    return NextResponse.json({ channel: updated });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Gateway bağlantı hatası";
    const message =
      /fetch failed|ECONNREFUSED|WhatsApp servisine ulaşılamadı/i.test(raw)
        ? "WhatsApp servisi başlatılamadı. Hostinger'da Entry file=server.js olduğundan emin olup Redeploy/Restart edin."
        : raw;
    await prisma.channel.update({
      where: { id },
      data: { status: "ERROR", lastError: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const channel = await prisma.channel.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!channel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (channel.sessionId) {
    await waGateway.stopSession(channel.sessionId).catch(() => undefined);
  }

  const updated = await prisma.channel.update({
    where: { id },
    data: { status: "DISCONNECTED", qrData: null, lastError: null },
  });
  return NextResponse.json({ channel: updated });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const channel = await prisma.channel.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!channel?.sessionId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const status = await waGateway.getStatus(channel.sessionId);
    const updated = await prisma.channel.update({
      where: { id },
      data: {
        status: status.status,
        qrData: status.qrDataUrl ?? null,
        phoneNumber: status.phoneNumber ?? channel.phoneNumber,
        lastError: status.lastError ?? null,
        connectedAt: status.status === "CONNECTED" ? new Date() : channel.connectedAt,
      },
    });
    return NextResponse.json({ channel: updated });
  } catch {
    return NextResponse.json({ channel });
  }
}
