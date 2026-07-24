import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdmin, platformAdminEmails } from "@/lib/platform-admin";
import { PLAN_LIMITS } from "@/lib/plans";

async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user || !isPlatformAdmin(session.user.email)) return null;
  return session;
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  plan: z.enum(["BASIC", "PRO"]).optional(),
  maxUsers: z.number().int().min(1).max(500).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { id } = await ctx.params;
  const org = await prisma.organization.findUnique({ where: { id } });
  if (!org) return NextResponse.json({ error: "Organizasyon bulunamadı" }, { status: 404 });

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }
  const { name, plan, maxUsers } = parsed.data;

  const organization = await prisma.organization.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(plan
        ? { plan, maxUsers: maxUsers ?? PLAN_LIMITS[plan].maxUsers }
        : maxUsers
          ? { maxUsers }
          : {}),
    },
    select: { id: true, name: true, slug: true, plan: true, maxUsers: true },
  });

  return NextResponse.json({ organization });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { id } = await ctx.params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: { users: { select: { email: true } } },
  });
  if (!org) return NextResponse.json({ error: "Organizasyon bulunamadı" }, { status: 404 });

  // Süper admin hesabının bulunduğu organizasyon silinemez.
  const adminEmails = platformAdminEmails();
  if (org.users.some((u) => adminEmails.includes(u.email.toLowerCase()))) {
    return NextResponse.json(
      { error: "Platform yöneticisinin bulunduğu organizasyon silinemez" },
      { status: 400 },
    );
  }

  // Tüm ilişkili veriler (kullanıcılar, kanallar, sohbetler...) cascade silinir.
  await prisma.organization.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
