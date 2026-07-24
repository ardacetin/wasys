import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: { plan: "PRO", maxUsers: 50 },
  });

  return NextResponse.json({ ok: true });
}
