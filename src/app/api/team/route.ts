import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [users, org] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: session.user.organizationId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organization.findUnique({ where: { id: session.user.organizationId } }),
  ]);

  return NextResponse.json(
    {
      users,
      plan: org?.plan,
      maxUsers: org?.maxUsers ?? 5,
      me: { id: session.user.id, role: session.user.role },
    },
    { headers: { "Cache-Control": "private, max-age=20" } },
  );
}

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "AGENT"]).default("AGENT"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    include: { _count: { select: { users: true } } },
  });
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const limit = org.maxUsers;
  if (org._count.users >= limit) {
    return NextResponse.json(
      { error: `Organizasyonunuza en fazla ${limit} kullanıcı eklenebilir. Limit artırımı için WASYS yöneticisiyle iletişime geçin.` },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ad (en az 2 karakter), geçerli e-posta ve şifre (en az 6 karakter) zorunludur" },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const email = data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.json({ error: "E-posta kullanımda" }, { status: 400 });
  }

  const user = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: data.name,
      email,
      role: data.role,
      passwordHash: await hash(data.password, 10),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user });
}
