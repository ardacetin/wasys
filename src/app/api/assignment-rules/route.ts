import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await prisma.assignmentRule.findMany({
    where: { organizationId: session.user.organizationId },
    include: { assignTo: { select: { id: true, name: true } } },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ rules });
}

const schema = z.object({
  name: z.string().min(2),
  matchType: z.enum(["KEYWORD", "TAG", "CHANNEL", "UNASSIGNED"]),
  matchValue: z.string().optional().nullable(),
  assignToId: z.string().optional().nullable(),
  priority: z.number().int().min(1).max(999).default(100),
  isActive: z.boolean().default(true),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const data = schema.parse(await req.json());
  const rule = await prisma.assignmentRule.create({
    data: {
      organizationId: session.user.organizationId,
      name: data.name,
      matchType: data.matchType,
      matchValue: data.matchValue || null,
      assignToId: data.assignToId || null,
      priority: data.priority,
      isActive: data.isActive,
    },
    include: { assignTo: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ rule });
}
