import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOrgAdmin } from "@/lib/roles";
import { normalizeShortcut } from "@/lib/template-shortcuts";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await prisma.messageTemplate.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { title: "asc" },
  });
  return NextResponse.json({ templates });
}

const schema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  shortcut: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOrgAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Şablonları yalnızca yönetici ekleyebilir" },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Başlık ve mesaj içeriği zorunludur" },
      { status: 400 },
    );
  }

  const template = await prisma.messageTemplate.create({
    data: {
      organizationId: session.user.organizationId,
      title: parsed.data.title.trim(),
      body: parsed.data.body.trim(),
      shortcut: normalizeShortcut(parsed.data.shortcut),
    },
  });
  return NextResponse.json({ template });
}
