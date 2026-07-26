import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOrgAdmin } from "@/lib/roles";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().trim().min(4).max(32).optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOrgAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Etiketleri yalnızca yönetici düzenleyebilir" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const existing = await prisma.tag.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  try {
    const tag = await prisma.tag.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ tag });
  } catch {
    return NextResponse.json(
      { error: "Bu isimde bir etiket zaten var" },
      { status: 409 },
    );
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOrgAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Etiketleri yalnızca yönetici silebilir" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const existing = await prisma.tag.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.tag.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
