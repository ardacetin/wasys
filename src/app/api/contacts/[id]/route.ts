import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function findContact(id: string, organizationId: string) {
  return prisma.contact.findFirst({ where: { id, organizationId } });
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const contact = await prisma.contact.findFirst({
    where: { id, organizationId: session.user.organizationId },
    include: {
      crmNotes: {
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { author: { select: { id: true, name: true } } },
      },
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        take: 20,
        select: {
          id: true,
          lastMessageAt: true,
          lastMessagePreview: true,
          channel: { select: { name: true } },
          assignedTo: { select: { name: true } },
        },
      },
    },
  });
  if (!contact) {
    return NextResponse.json({ error: "Kişi bulunamadı" }, { status: 404 });
  }
  return NextResponse.json({ contact });
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z
    .string()
    .email()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  company: z.string().trim().max(120).nullable().optional(),
  crmStage: z.enum(["LEAD", "CONTACTED", "PROPOSAL", "WON", "LOST"]).optional(),
  dealValue: z.number().min(0).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const existing = await findContact(id, session.user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Kişi bulunamadı" }, { status: 404 });
  }

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }
  const data = parsed.data;

  const contact = await prisma.contact.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.email !== undefined ? { email: data.email } : {}),
      ...(data.company !== undefined ? { company: data.company || null } : {}),
      ...(data.crmStage !== undefined ? { crmStage: data.crmStage } : {}),
      ...(data.dealValue !== undefined ? { dealValue: data.dealValue } : {}),
      ...(data.notes !== undefined ? { notes: data.notes || null } : {}),
    },
    include: { _count: { select: { conversations: true, crmNotes: true } } },
  });

  return NextResponse.json({ contact });
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
    return NextResponse.json(
      { error: "Kişi silme için yönetici yetkisi gerekir" },
      { status: 403 },
    );
  }

  const { id } = await ctx.params;
  const existing = await findContact(id, session.user.organizationId);
  if (!existing) {
    return NextResponse.json({ error: "Kişi bulunamadı" }, { status: 404 });
  }

  // Sohbetler ve mesajlar zincirleme silinir (onDelete: Cascade)
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
