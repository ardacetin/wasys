import { NextResponse } from "next/server";
import { z } from "zod";
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

  const quoteRequests = await prisma.quoteRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ quoteRequests });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["NEW", "CONTACTED", "CLOSED"]),
});

export async function PATCH(req: Request) {
  const session = await requirePlatformAdmin();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const quote = await prisma.quoteRequest.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      contactedAt: parsed.data.status === "CONTACTED" ? new Date() : undefined,
    },
  });

  return NextResponse.json({ quote });
}
