import { NextResponse } from "next/server";
import type { Plan } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { analyzeIntent } from "@/lib/intent-ai";
import { assertFeature, featureDenied } from "@/lib/feature-gate";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!assertFeature(session.user.plan as Plan, "intentAi")) {
    return featureDenied("intentAi");
  }

  const { id } = await ctx.params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 50,
        select: { direction: true, body: true },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = analyzeIntent(conversation.messages);
  const suggestion = await prisma.intentSuggestion.create({
    data: {
      conversationId: conversation.id,
      intent: result.intent,
      confidence: result.confidence,
      summary: result.summary,
      suggestions: JSON.stringify(result.suggestions),
    },
  });

  return NextResponse.json({
    suggestion: {
      ...suggestion,
      suggestions: result.suggestions,
    },
  });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!assertFeature(session.user.plan as Plan, "intentAi")) {
    return featureDenied("intentAi");
  }

  const { id } = await ctx.params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const latest = await prisma.intentSuggestion.findFirst({
    where: { conversationId: id },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return NextResponse.json({ suggestion: null });

  return NextResponse.json({
    suggestion: {
      ...latest,
      suggestions: latest.suggestions ? JSON.parse(latest.suggestions) : [],
    },
  });
}
