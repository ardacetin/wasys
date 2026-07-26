import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOrgAdmin } from "@/lib/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await prisma.tag.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, color: true },
  });
  return NextResponse.json(
    { tags },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}

const schema = z.object({
  name: z.string().min(1),
  color: z.string().default("#0F766E"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOrgAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Etiketleri yalnızca yönetici ekleyebilir" },
      { status: 403 },
    );
  }

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz etiket verisi" }, { status: 400 });
  }

  try {
    const tag = await prisma.tag.create({
      data: {
        organizationId: session.user.organizationId,
        name: parsed.data.name.trim(),
        color: parsed.data.color,
      },
    });
    return NextResponse.json({ tag });
  } catch {
    return NextResponse.json(
      { error: "Bu isimde bir etiket zaten var" },
      { status: 409 },
    );
  }
}
