import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Yeni gelen (INBOUND) mesajları — tarayıcı bildirimi / ses için.
 * `since` sonrası kayıtları döner; ilk istekte backlog spam olmasın diye
 * istemci sunucu saatini cursor olarak kullanır.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const sinceRaw = searchParams.get("since");
  const since = sinceRaw ? new Date(sinceRaw) : new Date(Date.now() - 5_000);
  const sinceSafe = Number.isNaN(since.getTime())
    ? new Date(Date.now() - 5_000)
    : since;

  const messages = await prisma.message.findMany({
    where: {
      direction: "INBOUND",
      createdAt: { gt: sinceSafe },
      conversation: {
        organizationId: session.user.organizationId,
        isArchived: false,
      },
    },
    orderBy: { createdAt: "asc" },
    take: 40,
    select: {
      id: true,
      body: true,
      type: true,
      createdAt: true,
      conversationId: true,
      conversation: {
        select: {
          contact: { select: { name: true, phone: true } },
        },
      },
    },
  });

  return NextResponse.json({
    serverTime: new Date().toISOString(),
    messages: messages.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      body: m.body,
      type: m.type,
      createdAt: m.createdAt.toISOString(),
      contactName: m.conversation.contact.name,
      contactPhone: m.conversation.contact.phone,
    })),
  });
}
