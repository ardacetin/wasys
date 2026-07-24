import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiKey } from "@/lib/api-keys";
import { assertFeature, featureDenied } from "@/lib/feature-gate";
import { prisma } from "@/lib/db";
import { waGateway } from "@/lib/wa-gateway";
import { sendCloudText } from "@/lib/wa-cloud";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const apiKey = await authenticateApiKey(req.headers.get("authorization"));
  if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!assertFeature(apiKey.organization.plan, "apiAccess")) {
    return featureDenied("apiAccess");
  }

  const { id } = await ctx.params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: apiKey.organizationId },
    include: {
      contact: true,
      messages: { orderBy: { createdAt: "asc" }, take: 200 },
      tags: { include: { tag: true } },
    },
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ conversation });
}

const sendSchema = z.object({
  body: z.string().min(1),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const apiKey = await authenticateApiKey(req.headers.get("authorization"));
  if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!assertFeature(apiKey.organization.plan, "apiAccess")) {
    return featureDenied("apiAccess");
  }

  const { id } = await ctx.params;
  const payload = sendSchema.parse(await req.json());

  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: apiKey.organizationId },
    include: { contact: true, channel: true },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let externalId: string | undefined;
  let status: "SENT" | "FAILED" | "PENDING" = "PENDING";

  try {
    if (conversation.channel.type === "WHATSAPP_QR") {
      if (!conversation.channel.sessionId || conversation.channel.status !== "CONNECTED") {
        return NextResponse.json({ error: "Channel not connected" }, { status: 400 });
      }
      const result = await waGateway.sendText({
        sessionId: conversation.channel.sessionId,
        to: conversation.contact.phone,
        text: payload.body,
      });
      externalId = result.externalId;
      status = "SENT";
    } else if (conversation.channel.type === "WHATSAPP_CLOUD") {
      if (!conversation.channel.metaPhoneId || !conversation.channel.metaToken) {
        return NextResponse.json({ error: "Cloud API config missing" }, { status: 400 });
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
  } catch {
    status = "FAILED";
  }

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      type: "TEXT",
      status,
      body: payload.body,
      externalId,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: payload.body.slice(0, 140),
    },
  });

  return NextResponse.json({ message });
}
