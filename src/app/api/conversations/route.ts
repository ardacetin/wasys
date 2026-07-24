import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Çevrimiçi tespiti için heartbeat: dakikada en fazla bir kez lastActiveAt güncelle
const HEARTBEAT_THROTTLE_MS = 60 * 1000;
const lastHeartbeat = new Map<string, number>();

function touchUserActivity(userId: string) {
  const now = Date.now();
  const previous = lastHeartbeat.get(userId) ?? 0;
  if (now - previous < HEARTBEAT_THROTTLE_MS) return;
  lastHeartbeat.set(userId, now);
  // updateMany: kayıt yoksa (eski oturum / silinmiş kullanıcı) hata fırlatmaz
  prisma.user
    .updateMany({
      where: { id: userId },
      data: { lastActiveAt: new Date() },
    })
    .catch(() => undefined);
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  touchUserActivity(session.user.id);

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
    include: {
      contact: true,
      channel: true,
      assignedTo: { select: { id: true, name: true } },
      tags: { include: { tag: true } },
    },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ conversations });
}
