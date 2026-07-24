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

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { id } = await ctx.params;
  const users = await prisma.user.findMany({
    where: { organizationId: id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users });
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(6).max(128),
  role: z.enum(["OWNER", "ADMIN", "AGENT"]).default("AGENT"),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });

  const { id } = await ctx.params;
  const org = await prisma.organization.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!org) return NextResponse.json({ error: "Organizasyon bulunamadı" }, { status: 404 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ad (en az 2 karakter), geçerli e-posta ve şifre (en az 6 karakter) zorunludur" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const limit = org.maxUsers;
  if (org._count.users >= limit) {
    return NextResponse.json(
      { error: `Bu organizasyonda en fazla ${limit} kullanıcı olabilir` },
      { status: 400 },
    );
  }

  const email = data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "Bu e-posta zaten kullanımda" }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: {
      organizationId: id,
      name: data.name,
      email,
      role: data.role,
      passwordHash: await hash(data.password, 10),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
