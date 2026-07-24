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

  const [organizations, users, quoteRequests, conversations, contacts] =
    await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.quoteRequest.count(),
      prisma.conversation.count(),
      prisma.contact.count(),
    ]);

  const openQuotes = await prisma.quoteRequest.count({
    where: { status: "NEW" },
  });

  const recentOrgs = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      name: true,
      plan: true,
      maxUsers: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });

  const recentQuotes = await prisma.quoteRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      userCount: true,
      plan: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    stats: {
      organizations,
      users,
      quoteRequests,
      openQuotes,
      conversations,
      contacts,
    },
    recentOrgs,
    recentQuotes,
  });
}
