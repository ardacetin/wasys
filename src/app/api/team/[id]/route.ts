import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function requireManager() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    return { error: NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir" }, { status: 403 }) };
  }
  return { session };
}

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(["ADMIN", "AGENT"]).optional(),
  password: z.string().min(6).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireManager();
  if (error) return error;

  const { id } = await ctx.params;
  const target = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!target) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }
  const { name, role, password } = parsed.data;

  // OWNER hesabı korunur: rolü değiştirilemez, sadece OWNER kendini düzenleyebilir.
  if (target.role === "OWNER") {
    if (session.user.id !== target.id) {
      return NextResponse.json({ error: "Platform yöneticisi düzenlenemez" }, { status: 403 });
    }
    if (role) {
      return NextResponse.json({ error: "OWNER rolü değiştirilemez" }, { status: 400 });
    }
  }

  // ADMIN başka bir ADMIN'i yönetemez (yalnızca OWNER yönetir).
  if (
    target.role === "ADMIN" &&
    session.user.role !== "OWNER" &&
    session.user.id !== target.id
  ) {
    return NextResponse.json({ error: "Yöneticileri yalnızca hesap sahibi düzenleyebilir" }, { status: 403 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(role ? { role } : {}),
      ...(password ? { passwordHash: await hash(password, 10) } : {}),
    },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  return NextResponse.json({ user });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireManager();
  if (error) return error;

  const { id } = await ctx.params;
  const target = await prisma.user.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!target) {
    return NextResponse.json({ error: "Kullanıcı bulunamadı" }, { status: 404 });
  }

  if (target.id === session.user.id) {
    return NextResponse.json({ error: "Kendi hesabınızı silemezsiniz" }, { status: 400 });
  }
  if (target.role === "OWNER") {
    return NextResponse.json({ error: "Platform yöneticisi silinemez" }, { status: 400 });
  }
  if (target.role === "ADMIN" && session.user.role !== "OWNER") {
    return NextResponse.json({ error: "Yöneticileri yalnızca hesap sahibi silebilir" }, { status: 403 });
  }

  // Optional ilişkiler (atanmış sohbetler, gönderilen mesajlar, kurallar) otomatik NULL'a çekilir.
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
