import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const schema = z.object({ body: z.string().trim().min(1).max(4000) });

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const contact = await prisma.contact.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true },
  });
  if (!contact) {
    return NextResponse.json({ error: "Kişi bulunamadı" }, { status: 404 });
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Not boş olamaz" }, { status: 400 });
  }

  const note = await prisma.contactNote.create({
    data: {
      contactId: contact.id,
      authorId: session.user.id,
      body: parsed.data.body,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ note }, { status: 201 });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const noteId = searchParams.get("noteId");
  if (!noteId) {
    return NextResponse.json({ error: "noteId gerekli" }, { status: 400 });
  }

  const note = await prisma.contactNote.findFirst({
    where: {
      id: noteId,
      contactId: id,
      contact: { organizationId: session.user.organizationId },
    },
  });
  if (!note) {
    return NextResponse.json({ error: "Not bulunamadı" }, { status: 404 });
  }

  // Yalnızca notu yazan ya da yöneticiler silebilir
  const isManager = ["OWNER", "ADMIN"].includes(session.user.role);
  if (!isManager && note.authorId !== session.user.id) {
    return NextResponse.json({ error: "Bu notu silme yetkiniz yok" }, { status: 403 });
  }

  await prisma.contactNote.delete({ where: { id: noteId } });
  return NextResponse.json({ ok: true });
}
