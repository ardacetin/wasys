import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { applyAssignmentRules, loadConversationTagIds } from "@/lib/assignment";
import {
  anyAgentOnline,
  awayMessageRecentlySent,
  fillAutoMessage,
} from "@/lib/auto-reply";
import { analyzeIntent } from "@/lib/intent-ai";
import { hasFeature } from "@/lib/plans";
import {
  sendCloudText,
  verifyMetaSignature,
  verifyMetaWebhook,
} from "@/lib/wa-cloud";

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

async function sendCloudAutoReply(
  channel: { id: string; metaPhoneId: string | null; metaToken: string | null },
  conversationId: string,
  phone: string,
  text: string,
) {
  if (!channel.metaPhoneId || !channel.metaToken) return;
  try {
    const result = await sendCloudText({
      phoneNumberId: channel.metaPhoneId,
      accessToken: channel.metaToken,
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
    console.error("[WASYS Cloud] otomatik mesaj gönderilemedi", error);
  }
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signatureOk = await verifyMetaSignature(
    rawBody,
    req.headers.get("x-hub-signature-256"),
  );
  if (!signatureOk) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
          messages?: Array<{
            id?: string;
            from?: string;
            type?: string;
            text?: { body?: string };
            button?: { text?: string };
          }>;
          statuses?: Array<{ id?: string; status?: string }>;
        };
      }>;
    }>;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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

      // Webhook trafiği geliyorsa kanalı bağlı say
      if (channel.status !== "CONNECTED") {
        await prisma.channel.update({
          where: { id: channel.id },
          data: { status: "CONNECTED", connectedAt: new Date(), lastError: null },
        });
      }

      const profileNameByWaId = new Map<string, string>();
      for (const c of value?.contacts ?? []) {
        if (c.wa_id && c.profile?.name) {
          profileNameByWaId.set(c.wa_id.replace(/\D/g, ""), c.profile.name);
        }
      }

      for (const msg of value.messages ?? []) {
        const phone = String(msg.from ?? "").replace(/\D/g, "");
        if (!phone) continue;

        const pushName = profileNameByWaId.get(phone) ?? null;

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
              name: pushName ?? phone,
            },
          });
        } else if (pushName && !contact.name) {
          contact = await prisma.contact.update({
            where: { id: contact.id },
            data: { name: pushName },
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

        const existing = await prisma.message.findFirst({
          where: { externalId: msg.id },
        });
        if (existing) continue;

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

        const tagIds = await loadConversationTagIds(conversation.id);
        const assignToId = await applyAssignmentRules({
          organizationId: channel.organizationId,
          channelId: channel.id,
          messageBody: text,
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

        if (
          org?.welcomeMessageEnabled &&
          org.welcomeMessage?.trim() &&
          isNewConversation
        ) {
          await sendCloudAutoReply(
            channel,
            conversation.id,
            contact.phone,
            fillAutoMessage(org.welcomeMessage.trim(), contact),
          );
        }

        if (org?.awayMessageEnabled && org.awayMessage?.trim()) {
          const awayText = fillAutoMessage(org.awayMessage.trim(), contact);
          const online = await anyAgentOnline(channel.organizationId);
          if (
            !online &&
            !(await awayMessageRecentlySent(conversation.id, awayText))
          ) {
            await sendCloudAutoReply(
              channel,
              conversation.id,
              contact.phone,
              awayText,
            );
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
