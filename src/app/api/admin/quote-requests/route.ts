import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";

export async function GET() {
  const session = await auth();
  if (!session?.user || !isPlatformAdmin(session.user.email)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const quoteRequests = await prisma.quoteRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ quoteRequests });
}
