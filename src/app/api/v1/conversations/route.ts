import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { assertFeature, featureDenied } from "@/lib/feature-gate";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const apiKey = await authenticateApiKey(req.headers.get("authorization"));
  if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!assertFeature(apiKey.organization.plan, "apiAccess")) {
    return featureDenied("apiAccess");
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

  const conversations = await prisma.conversation.findMany({
    where: { organizationId: apiKey.organizationId, isArchived: false },
    include: {
      contact: { select: { id: true, name: true, phone: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      tags: { include: { tag: true } },
      channel: { select: { id: true, name: true, type: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ conversations });
}
