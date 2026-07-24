import { prisma } from "@/lib/db";

export type RuleContext = {
  organizationId: string;
  channelId: string;
  messageBody?: string | null;
  isNewConversation: boolean;
  currentAssignedToId?: string | null;
  tagIds?: string[];
};

const ONLINE_WINDOW_MS = 5 * 60 * 1000;

async function pickAgent(
  organizationId: string,
  mode: "BALANCED" | "RANDOM",
) {
  const baseWhere = {
    organizationId,
    role: { in: ["AGENT", "ADMIN", "OWNER"] as ("AGENT" | "ADMIN" | "OWNER")[] },
  };

  let agents = await prisma.user.findMany({
    where: {
      ...baseWhere,
      lastActiveAt: { gte: new Date(Date.now() - ONLINE_WINDOW_MS) },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!agents.length) {
    agents = await prisma.user.findMany({
      where: baseWhere,
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
  }
  if (!agents.length) return null;

  if (mode === "RANDOM") {
    return agents[Math.floor(Math.random() * agents.length)].id;
  }

  const counts = await Promise.all(
    agents.map(async (a) => ({
      id: a.id,
      n: await prisma.conversation.count({
        where: { organizationId, assignedToId: a.id, isArchived: false },
      }),
    })),
  );
  counts.sort((a, b) => a.n - b.n);
  return counts[0]?.id ?? null;
}

/** Tek bir kuralın bağlamla eşleşip eşleşmediği (test edilebilir). */
export function ruleMatches(
  rule: { matchType: string; matchValue: string | null },
  ctx: RuleContext,
): boolean {
  const body = (ctx.messageBody ?? "").toLowerCase();

  switch (rule.matchType) {
    case "KEYWORD":
      return Boolean(
        rule.matchValue && body.includes(rule.matchValue.toLowerCase()),
      );
    case "CHANNEL":
      return rule.matchValue === ctx.channelId || rule.matchValue === "*";
    case "TAG":
      return Boolean(
        rule.matchValue && (ctx.tagIds ?? []).includes(rule.matchValue),
      );
    case "UNASSIGNED":
      return ctx.isNewConversation || !ctx.currentAssignedToId;
    default:
      return false;
  }
}

/**
 * İlk eşleşen aktif kuralı uygular (öncelik ASC).
 * Sohbet zaten atanmışsa dokunmaz.
 * Hiçbir kural eşleşmezse organizasyon distributionMode (BALANCED/RANDOM) kullanılır.
 */
export async function applyAssignmentRules(ctx: RuleContext) {
  if (ctx.currentAssignedToId) return null;

  const rules = await prisma.assignmentRule.findMany({
    where: { organizationId: ctx.organizationId, isActive: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  for (const rule of rules) {
    if (!ruleMatches(rule, ctx)) continue;

    let assignToId = rule.assignToId;
    if (!assignToId) {
      assignToId = await pickAgent(ctx.organizationId, "BALANCED");
    }

    if (!assignToId) return null;
    return assignToId;
  }

  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { distributionMode: true },
  });
  if (org?.distributionMode === "BALANCED" || org?.distributionMode === "RANDOM") {
    return pickAgent(ctx.organizationId, org.distributionMode);
  }

  return null;
}

/** Sohbetin etiket id listesini yükler (TAG kuralları için). */
export async function loadConversationTagIds(conversationId: string) {
  const rows = await prisma.conversationTag.findMany({
    where: { conversationId },
    select: { tagId: true },
  });
  return rows.map((r) => r.tagId);
}
