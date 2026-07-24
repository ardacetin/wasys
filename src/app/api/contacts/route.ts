import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { CrmStage, Prisma } from "@prisma/client";

const STAGES: CrmStage[] = ["LEAD", "CONTACTED", "PROPOSAL", "WON", "LOST"];

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const organizationId = session.user.organizationId;

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const stage = searchParams.get("stage");

  const where: Prisma.ContactWhereInput = {
    organizationId,
    ...(stage && STAGES.includes(stage as CrmStage)
      ? { crmStage: stage as CrmStage }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { email: { contains: q } },
            { company: { contains: q } },
          ],
        }
      : {}),
  };

  const [contacts, grouped] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: {
        _count: { select: { conversations: true, crmNotes: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.contact.groupBy({
      by: ["crmStage"],
      where: { organizationId },
      _count: { _all: true },
      _sum: { dealValue: true },
    }),
  ]);

  const summary = Object.fromEntries(
    STAGES.map((s) => {
      const g = grouped.find((x) => x.crmStage === s);
      return [s, { count: g?._count._all ?? 0, value: g?._sum.dealValue ?? 0 }];
    }),
  );

  return NextResponse.json({ contacts, summary });
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(5).max(30),
  email: z.string().email().nullable().optional().or(z.literal("").transform(() => null)),
  company: z.string().trim().max(120).nullable().optional(),
  crmStage: z.enum(["LEAD", "CONTACTED", "PROPOSAL", "WON", "LOST"]).optional(),
  dealValue: z.number().min(0).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz veri: ad ve telefon zorunludur, e-posta geçerli olmalıdır" },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const phone = data.phone.replace(/\D/g, "");
  if (phone.length < 5) {
    return NextResponse.json({ error: "Geçerli bir telefon numarası girin" }, { status: 400 });
  }

  const exists = await prisma.contact.findUnique({
    where: {
      organizationId_phone: {
        organizationId: session.user.organizationId,
        phone,
      },
    },
  });
  if (exists) {
    return NextResponse.json(
      { error: "Bu telefon numarası zaten kayıtlı" },
      { status: 409 },
    );
  }

  const contact = await prisma.contact.create({
    data: {
      organizationId: session.user.organizationId,
      name: data.name,
      phone,
      email: data.email ?? null,
      company: data.company || null,
      crmStage: data.crmStage ?? "LEAD",
      dealValue: data.dealValue ?? null,
      notes: data.notes || null,
    },
    include: { _count: { select: { conversations: true, crmNotes: true } } },
  });

  return NextResponse.json({ contact }, { status: 201 });
}
