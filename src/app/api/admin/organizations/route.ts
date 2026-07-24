import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/platform-admin";

const createOrganizationSchema = z.object({
  organizationName: z.string().trim().min(2).max(80),
  ownerName: z.string().trim().min(2).max(80),
  ownerEmail: z.string().email(),
  temporaryPassword: z.string().min(8).max(128),
  plan: z.enum(["BASIC", "PRO"]).default("BASIC"),
  // Bu müşteri hesabına eklenebilecek toplam kullanıcı (owner + agent + süpervizör)
  maxUsers: z.coerce.number().int().min(1).max(500).optional(),
});

function slugify(input: string) {
  return input
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

async function requirePlatformAdmin() {
  const session = await auth();
  if (!session?.user || !isPlatformAdmin(session.user.email)) return null;
  return session;
}

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      maxUsers: true,
      createdAt: true,
      _count: { select: { users: true, contacts: true, conversations: true } },
      users: {
        where: { role: "OWNER" },
        take: 1,
        select: { name: true, email: true },
      },
    },
  });

  return NextResponse.json({ organizations });
}

export async function POST(req: Request) {
  const session = await requirePlatformAdmin();
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const parsed = createOrganizationSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Geçersiz form" },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const ownerEmail = data.ownerEmail.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (existingUser) {
    return NextResponse.json({ error: "Bu e-posta zaten kullanımda" }, { status: 409 });
  }

  const baseSlug = slugify(data.organizationName) || "organizasyon";
  let slug = baseSlug;
  if (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${Date.now().toString(36)}`;
  }

  const maxUsers =
    data.maxUsers ?? (data.plan === "PRO" ? 50 : 5);

  const organization = await prisma.organization.create({
    data: {
      name: data.organizationName,
      slug,
      plan: data.plan,
      maxUsers,
      users: {
        create: {
          name: data.ownerName,
          email: ownerEmail,
          passwordHash: await hash(data.temporaryPassword, 12),
          role: "OWNER",
        },
      },
      channels: {
        create: {
          name: "Ana WhatsApp",
          type: "WHATSAPP_QR",
          status: "DISCONNECTED",
          sessionId: `sess_${slug.slice(0, 12)}_${Date.now().toString(36)}`,
        },
      },
      tags: {
        create: [
          { name: "Yeni Lead", color: "#0F766E" },
          { name: "Sipariş", color: "#C2410C" },
          { name: "Destek", color: "#1D4ED8" },
        ],
      },
      templates: {
        create: {
          title: "Karşılama",
          body: "Merhaba! Size nasıl yardımcı olabiliriz?",
          shortcut: "/merhaba",
        },
      },
      quickButtons: {
        create: [
          {
            label: "Merhaba",
            body: "Merhaba! Size nasıl yardımcı olabilirim?",
            sortOrder: 1,
          },
          { label: "Teşekkürler", body: "Teşekkür ederiz!", sortOrder: 2 },
        ],
      },
    },
    select: { id: true, name: true, slug: true, plan: true },
  });

  return NextResponse.json({ organization }, { status: 201 });
}
