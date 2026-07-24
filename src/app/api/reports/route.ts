import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    openConversations,
    unassigned,
    messages24h,
    inbound24h,
    outbound24h,
    contactsTotal,
    byAgent,
    recentMessages,
    tagUsage,
  ] = await Promise.all([
    prisma.conversation.count({ where: { organizationId: orgId, isArchived: false } }),
    prisma.conversation.count({
      where: { organizationId: orgId, isArchived: false, assignedToId: null },
    }),
    prisma.message.count({
      where: { conversation: { organizationId: orgId }, createdAt: { gte: since24h } },
    }),
    prisma.message.count({
      where: {
        conversation: { organizationId: orgId },
        direction: "INBOUND",
        createdAt: { gte: since24h },
      },
    }),
    prisma.message.count({
      where: {
        conversation: { organizationId: orgId },
        direction: "OUTBOUND",
        createdAt: { gte: since24h },
      },
    }),
    prisma.contact.count({ where: { organizationId: orgId } }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        _count: { select: { assignedConversations: { where: { isArchived: false } } } },
      },
    }),
    prisma.message.findMany({
      where: { conversation: { organizationId: orgId }, createdAt: { gte: since7d } },
      select: { createdAt: true, direction: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tag.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        color: true,
        _count: { select: { conversations: true } },
      },
    }),
  ]);

  // Daily buckets for last 7 days
  const days: { date: string; inbound: number; outbound: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, inbound: 0, outbound: 0 });
  }

  for (const m of recentMessages) {
    const key = new Date(m.createdAt).toISOString().slice(0, 10);
    const bucket = days.find((x) => x.date === key);
    if (!bucket) continue;
    if (m.direction === "INBOUND") bucket.inbound += 1;
    else bucket.outbound += 1;
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary: {
      openConversations,
      unassigned,
      messages24h,
      inbound24h,
      outbound24h,
      contactsTotal,
    },
    byAgent: byAgent.map((a) => ({
      id: a.id,
      name: a.name,
      openAssigned: a._count.assignedConversations,
    })),
    daily: days,
    tags: tagUsage.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      count: t._count.conversations,
    })),
  });
}
