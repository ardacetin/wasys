import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const buttons = await prisma.quickButton.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true, body: true, sortOrder: true },
  });
  return NextResponse.json(
    { buttons },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}
