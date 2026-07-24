import { NextResponse } from "next/server";
import { verifyMetaWebhook } from "@/lib/wa-cloud";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const challenge = verifyMetaWebhook(
    searchParams.get("hub.mode"),
    searchParams.get("hub.verify_token"),
    searchParams.get("hub.challenge"),
  );
  if (challenge) return new NextResponse(challenge, { status: 200 });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  const body = await req.json();
  const entries = body?.entry ?? [];

  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const channel = await prisma.channel.findFirst({
        where: { metaPhoneId: phoneNumberId, type: "WHATSAPP_CLOUD" },
      });
      if (!channel) continue;

      for (const msg of value.messages ?? []) {
        const phone = String(msg.from ?? "").replace(/\D/g, "");
        if (!phone) continue;

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
              name: phone,
            },
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

        const text = msg.text?.body ?? msg.button?.text ?? "[Mesaj]";

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              organizationId: channel.organizationId,
              channelId: channel.id,
              contactId: contact.id,
              lastMessageAt: new Date(),
              lastMessagePreview: text.slice(0, 140),
              unreadCount: 1,
            },
          });
        } else {
          conversation = await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              lastMessageAt: new Date(),
              lastMessagePreview: text.slice(0, 140),
              unreadCount: { increment: 1 },
            },
          });
        }

        const existing = await prisma.message.findFirst({ where: { externalId: msg.id } });
        if (!existing) {
          await prisma.message.create({
            data: {
              conversationId: conversation.id,
              direction: "INBOUND",
              type: msg.type === "audio" ? "AUDIO" : "TEXT",
              status: "DELIVERED",
              body: text,
              externalId: msg.id,
            },
          });
        }
      }

      for (const status of value.statuses ?? []) {
        if (!status.id) continue;
        const mapped =
          status.status === "read"
            ? "READ"
            : status.status === "delivered"
              ? "DELIVERED"
              : status.status === "sent"
                ? "SENT"
                : status.status === "failed"
                  ? "FAILED"
                  : null;
        if (mapped) {
          await prisma.message.updateMany({
            where: { externalId: status.id },
            data: { status: mapped },
          });
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
