import { prisma } from "@/lib/db";

type RuleContext = {
  organizationId: string;
  channelId: string;
  messageBody?: string | null;
  isNewConversation: boolean;
  currentAssignedToId?: string | null;
  tagIds?: string[];
};

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
      // Round-robin fallback among agents
      const agents = await prisma.user.findMany({
        where: {
          organizationId: ctx.organizationId,
          role: { in: ["AGENT", "ADMIN", "OWNER"] },
        },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (!agents.length) return null;
      const counts = await Promise.all(
        agents.map(async (a) => ({
          id: a.id,
          n: await prisma.conversation.count({
            where: { organizationId: ctx.organizationId, assignedToId: a.id, isArchived: false },
          }),
        })),
      );
      counts.sort((a, b) => a.n - b.n);
      assignToId = counts[0]?.id ?? null;
    }

    if (!assignToId) return null;
    return assignToId;
  }

  return null;
}
