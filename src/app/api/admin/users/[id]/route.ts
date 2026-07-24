import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";

async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user || !isPlatformAdmin(session.user.email)) return null;
  return session;
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  role: z.enum(["OWNER", "ADMIN", "AGENT"]).optional(),
  password: z.string().min(6).max(128).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }
  const { name, role, password } = parsed.data;

  // Süper admin hesabının rolü platform panelinden düşürülemez.
  if (isPlatformAdmin(target.email) && role && role !== "OWNER") {
    return NextResponse.json(
      { error: "Platform yöneticisinin rolü değiştirilemez" },
      { status: 400 },
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(role ? { role } : {}),
      ...(password ? { passwordHash: await hash(password, 10) } : {}),
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ user });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { id } = await ctx.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });

  if (target.id === session.user.id || isPlatformAdmin(target.email)) {
    return NextResponse.json(
      { error: "Platform yöneticisi hesabı silinemez" },
      { status: 400 },
    );
  }

  // Atanmış sohbetler ve mesaj geçmişi korunur (ilişkiler boşa düşer).
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
