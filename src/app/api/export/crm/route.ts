import { NextRequest, NextResponse } from "next/server";
import type { CrmStage, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildCrmContactsExcel, formatExportDate } from "@/lib/excel-export";

const STAGES: CrmStage[] = ["LEAD", "CONTACTED", "PROPOSAL", "WON", "LOST"];

const STAGE_LABELS: Record<CrmStage, string> = {
  LEAD: "Yeni Lead",
  CONTACTED: "İletişimde",
  PROPOSAL: "Teklif",
  WON: "Kazanıldı",
  LOST: "Kaybedildi",
};

const MAX_ROWS = 10_000;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const organizationId = session.user.organizationId;
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const stage = params.get("stage");

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

  const contacts = await prisma.contact.findMany({
    where,
    include: {
      _count: { select: { conversations: true, crmNotes: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: MAX_ROWS,
  });

  const buffer = await buildCrmContactsExcel(
    contacts.map((c) => ({
      name: c.name?.trim() || c.phone,
      phone: c.phone,
      email: c.email ?? "",
      company: c.company ?? "",
      stage: STAGE_LABELS[c.crmStage] ?? c.crmStage,
      dealValue: c.dealValue ?? "",
      notes: c.notes ?? "",
      conversations: c._count.conversations,
      noteCount: c._count.crmNotes,
      updatedAt: formatExportDate(c.updatedAt),
    })),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="wasys-crm-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
