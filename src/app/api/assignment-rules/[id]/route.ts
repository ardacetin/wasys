import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.assignmentRule.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = z
    .object({
      name: z.string().min(2).optional(),
      matchType: z.enum(["KEYWORD", "TAG", "CHANNEL", "UNASSIGNED"]).optional(),
      matchValue: z.string().nullable().optional(),
      assignToId: z.string().nullable().optional(),
      priority: z.number().int().optional(),
      isActive: z.boolean().optional(),
    })
    .parse(await req.json());

  const rule = await prisma.assignmentRule.update({
    where: { id },
    data: body,
    include: { assignTo: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ rule });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const existing = await prisma.assignmentRule.findFirst({
    where: { id, organizationId: session.user.organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.assignmentRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
