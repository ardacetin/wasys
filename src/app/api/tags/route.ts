import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await prisma.tag.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ tags });
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

  const data = schema.parse(await req.json());
  const tag = await prisma.tag.create({
    data: {
      organizationId: session.user.organizationId,
      ...data,
    },
  });
  return NextResponse.json({ tag });
}
