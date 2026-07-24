import { prisma } from "@/lib/db";

type RuleContext = {
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

  // Önce çevrimiçi (son 5 dk aktif) ekip üyeleri; kimse yoksa tüm ekip
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

  // BALANCED: açık sohbeti en az olan ekip üyesi
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

/**
 * Applies the first matching active assignment rule (by priority ASC).
 * Only assigns when conversation is currently unassigned, unless matchType is CHANNEL with explicit force via UNASSIGNED rules.
 */
export async function applyAssignmentRules(ctx: RuleContext) {
  if (ctx.currentAssignedToId) return null;

  const rules = await prisma.assignmentRule.findMany({
    where: { organizationId: ctx.organizationId, isActive: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  const body = (ctx.messageBody ?? "").toLowerCase();

  for (const rule of rules) {
    let matched = false;

    switch (rule.matchType) {
      case "KEYWORD":
        matched = !!rule.matchValue && body.includes(rule.matchValue.toLowerCase());
        break;
      case "CHANNEL":
        matched = rule.matchValue === ctx.channelId || rule.matchValue === "*";
        break;
      case "TAG":
        matched = !!rule.matchValue && (ctx.tagIds ?? []).includes(rule.matchValue);
        break;
      case "UNASSIGNED":
        matched = ctx.isNewConversation || !ctx.currentAssignedToId;
        break;
      default:
        matched = false;
    }

    if (!matched) continue;

    let assignToId = rule.assignToId;
    if (!assignToId) {
      assignToId = await pickAgent(ctx.organizationId, "BALANCED");
    }

    if (!assignToId) return null;
    return assignToId;
  }

  // Hiçbir kural eşleşmediyse organizasyonun genel dağıtım modu uygulanır
  const org = await prisma.organization.findUnique({
    where: { id: ctx.organizationId },
    select: { distributionMode: true },
  });
  if (org?.distributionMode === "BALANCED" || org?.distributionMode === "RANDOM") {
    return pickAgent(ctx.organizationId, org.distributionMode);
  }

  return null;
}
