import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tagId = searchParams.get("tagId");
  const q = searchParams.get("q")?.trim();
  const assigned = searchParams.get("assigned");

  const conversations = await prisma.conversation.findMany({
    where: {
      organizationId: session.user.organizationId,
      isArchived: false,
      ...(tagId ? { tags: { some: { tagId } } } : {}),
      ...(assigned === "me" ? { assignedToId: session.user.id } : {}),
      ...(assigned === "unassigned" ? { assignedToId: null } : {}),
      ...(q
        ? {
            OR: [
              { contact: { name: { contains: q } } },
              { contact: { phone: { contains: q } } },
              { lastMessagePreview: { contains: q } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      lastMessageAt: true,
      lastMessagePreview: true,
      unreadCount: true,
      contact: {
        select: { id: true, name: true, phone: true, email: true },
      },
      channel: {
        select: { id: true, name: true, type: true, status: true },
      },
      assignedTo: { select: { id: true, name: true } },
      tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 80,
  });

  return NextResponse.json(
    { conversations },
    {
      headers: {
        "Cache-Control": "private, no-cache",
      },
    },
  );
}
