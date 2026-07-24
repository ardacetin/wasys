import { NextRequest, NextResponse } from "next/server";
import {
  eachDayOfInterval,
  eachHourOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  startOfDay,
  startOfHour,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { tr } from "date-fns/locale";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

type Granularity = "hour" | "day" | "week" | "month";

const GRANULARITIES: Granularity[] = ["hour", "day", "week", "month"];

function bucketStart(date: Date, granularity: Granularity): Date {
  switch (granularity) {
    case "hour":
      return startOfHour(date);
    case "day":
      return startOfDay(date);
    case "week":
      return startOfWeek(date, { weekStartsOn: 1 });
    case "month":
      return startOfMonth(date);
  }
}

function bucketKey(date: Date, granularity: Granularity): string {
  const start = bucketStart(date, granularity);
  switch (granularity) {
    case "hour":
      return format(start, "yyyy-MM-dd HH:00");
    case "day":
    case "week":
      return format(start, "yyyy-MM-dd");
    case "month":
      return format(start, "yyyy-MM");
  }
}

function bucketLabel(start: Date, granularity: Granularity): string {
  switch (granularity) {
    case "hour":
      return format(start, "d MMM HH:00", { locale: tr });
    case "day":
      return format(start, "d MMM yyyy", { locale: tr });
    case "week":
      return `${format(start, "d MMM yyyy", { locale: tr })} haftası`;
    case "month":
      return format(start, "MMMM yyyy", { locale: tr });
  }
}

function enumerateBuckets(from: Date, to: Date, granularity: Granularity): Date[] {
  const interval = { start: from, end: to };
  switch (granularity) {
    case "hour":
      return eachHourOfInterval(interval);
    case "day":
      return eachDayOfInterval(interval);
    case "week":
      return eachWeekOfInterval(interval, { weekStartsOn: 1 });
    case "month":
      return eachMonthOfInterval(interval);
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = session.user.organizationId;
  const params = request.nextUrl.searchParams;

  const granularityParam = params.get("granularity") ?? "day";
  const granularity: Granularity = GRANULARITIES.includes(granularityParam as Granularity)
    ? (granularityParam as Granularity)
    : "day";

  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fromParam = params.get("from");
  const toParam = params.get("to");
  let from = fromParam ? new Date(fromParam) : defaultFrom;
  let to = toParam ? new Date(toParam) : now;
  if (Number.isNaN(from.getTime())) from = defaultFrom;
  if (Number.isNaN(to.getTime())) to = now;
  if (from > to) [from, to] = [to, from];

  // Guard: hourly view is capped at 31 days worth of buckets.
  const maxBuckets = granularity === "hour" ? 24 * 31 : 400;

  const [messages, conversationsInRange, users] = await Promise.all([
    prisma.message.findMany({
      where: {
        conversation: { organizationId: orgId },
        createdAt: { gte: from, lte: to },
      },
      select: {
        createdAt: true,
        direction: true,
        sentById: true,
        conversation: { select: { contactId: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.conversation.findMany({
      where: { organizationId: orgId, createdAt: { gte: from, lte: to } },
      select: {
        id: true,
        messages: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { direction: true, sentById: true },
        },
      },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // --- Time series buckets ---
  const bucketStarts = enumerateBuckets(from, to, granularity).slice(0, maxBuckets);
  const series = bucketStarts.map((start) => ({
    key: bucketKey(start, granularity),
    label: bucketLabel(start, granularity),
    inbound: 0,
    outbound: 0,
  }));
  const seriesByKey = new Map(series.map((s) => [s.key, s]));

  // --- Summary + per-agent aggregation ---
  let totalInbound = 0;
  let totalOutbound = 0;
  const uniqueContacts = new Set<string>();
  const agentStats = new Map<string, { outbound: number; contacts: Set<string> }>();

  for (const m of messages) {
    const bucket = seriesByKey.get(bucketKey(m.createdAt, granularity));
    if (m.direction === "INBOUND") {
      totalInbound += 1;
      if (bucket) bucket.inbound += 1;
    } else {
      totalOutbound += 1;
      if (bucket) bucket.outbound += 1;
      uniqueContacts.add(m.conversation.contactId);
      if (m.sentById) {
        let stat = agentStats.get(m.sentById);
        if (!stat) {
          stat = { outbound: 0, contacts: new Set<string>() };
          agentStats.set(m.sentById, stat);
        }
        stat.outbound += 1;
        stat.contacts.add(m.conversation.contactId);
      }
    }
  }

  // --- Conversation initiation breakdown ---
  let startedByUs = 0;
  let startedByCustomer = 0;
  const agentStartedConversations = new Map<string, number>();
  for (const c of conversationsInRange) {
    const first = c.messages[0];
    if (!first) continue;
    if (first.direction === "OUTBOUND") {
      startedByUs += 1;
      if (first.sentById) {
        agentStartedConversations.set(
          first.sentById,
          (agentStartedConversations.get(first.sentById) ?? 0) + 1,
        );
      }
    } else {
      startedByCustomer += 1;
    }
  }

  const byAgent = users
    .map((u) => {
      const stat = agentStats.get(u.id);
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        outbound: stat?.outbound ?? 0,
        uniqueContacts: stat?.contacts.size ?? 0,
        conversationsStarted: agentStartedConversations.get(u.id) ?? 0,
      };
    })
    .sort((a, b) => b.outbound - a.outbound);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    range: { from: from.toISOString(), to: to.toISOString(), granularity },
    summary: {
      totalOutbound,
      totalInbound,
      totalMessages: totalInbound + totalOutbound,
      uniqueContactsMessaged: uniqueContacts.size,
      conversationsStartedByUs: startedByUs,
      conversationsStartedByCustomer: startedByCustomer,
    },
    series: series.map(({ key, label, inbound, outbound }) => ({
      key,
      label,
      inbound,
      outbound,
      total: inbound + outbound,
    })),
    byAgent,
  });
}
