import { NextResponse } from "next/server";
import { z } from "zod";
import type { Plan } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateApiKey } from "@/lib/api-keys";
import { assertFeature, featureDenied } from "@/lib/feature-gate";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!assertFeature(session.user.plan as Plan, "apiAccess")) {
    return featureDenied("apiAccess");
  }

  const keys = await prisma.apiKey.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      revokedAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ keys });
}

const schema = z.object({
  name: z.string().min(2),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }
  if (!assertFeature(session.user.plan as Plan, "apiAccess")) {
    return featureDenied("apiAccess");
  }

  const data = schema.parse(await req.json());
  const generated = generateApiKey();

  const key = await prisma.apiKey.create({
    data: {
      organizationId: session.user.organizationId,
      name: data.name,
      keyHash: generated.hash,
      keyPrefix: generated.prefix,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    key,
    rawKey: generated.raw,
    warning: "Bu anahtar yalnızca bir kez gösterilir. Güvenli saklayın.",
  });
}
