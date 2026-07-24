import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { mailerConfigured } from "@/lib/mailer";

async function requireManager() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!["OWNER", "ADMIN"].includes(session.user.role)) {
    return { error: NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const { session, error } = await requireManager();
  if (error) return error;

  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      welcomeMessageEnabled: true,
      welcomeMessage: true,
      awayMessageEnabled: true,
      awayMessage: true,
      distributionMode: true,
      alertEmail: true,
    },
  });
  if (!org) return NextResponse.json({ error: "Organizasyon bulunamadı" }, { status: 404 });

  return NextResponse.json({ settings: org, smtpConfigured: mailerConfigured() });
}

const schema = z.object({
  welcomeMessageEnabled: z.boolean(),
  welcomeMessage: z.string().max(2000).nullable(),
  awayMessageEnabled: z.boolean(),
  awayMessage: z.string().max(2000).nullable(),
  distributionMode: z.enum(["NONE", "BALANCED", "RANDOM"]),
  alertEmail: z.string().email().nullable().or(z.literal("").transform(() => null)),
});

export async function PUT(req: Request) {
  const { session, error } = await requireManager();
  if (error) return error;

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri. Uyarı e-postası geçerli bir adres olmalı." }, { status: 400 });
  }
  const data = parsed.data;

  const settings = await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      welcomeMessageEnabled: data.welcomeMessageEnabled,
      welcomeMessage: data.welcomeMessage?.trim() || null,
      awayMessageEnabled: data.awayMessageEnabled,
      awayMessage: data.awayMessage?.trim() || null,
      distributionMode: data.distributionMode,
      alertEmail: data.alertEmail,
    },
    select: {
      welcomeMessageEnabled: true,
      welcomeMessage: true,
      awayMessageEnabled: true,
      awayMessage: true,
      distributionMode: true,
      alertEmail: true,
    },
  });

  return NextResponse.json({ settings });
}
