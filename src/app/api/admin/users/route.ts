import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";

async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user || !isPlatformAdmin(session.user.email)) return null;
  return session;
}

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      organization: {
        select: { id: true, name: true, plan: true, maxUsers: true },
      },
    },
  });

  return NextResponse.json({ users });
}
