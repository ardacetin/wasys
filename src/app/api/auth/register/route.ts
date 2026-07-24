import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

const schema = z.object({
  organizationName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const email = body.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Bu e-posta zaten kayıtlı" }, { status: 400 });
    }

    let slug = slugify(body.organizationName) || "org";
    const slugTaken = await prisma.organization.findUnique({ where: { slug } });
    if (slugTaken) slug = `${slug}-${Date.now().toString(36)}`;

    const passwordHash = await hash(body.password, 10);

    const org = await prisma.organization.create({
      data: {
        name: body.organizationName,
        slug,
        plan: "BASIC",
        maxUsers: 5,
        users: {
          create: {
            email,
            name: body.name,
            passwordHash,
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
          create: [
            {
              title: "Karşılama",
              body: "Merhaba! Size nasıl yardımcı olabiliriz?",
              shortcut: "/merhaba",
            },
          ],
        },
        quickButtons: {
          create: [
            { label: "Merhaba", body: "Merhaba! Size nasıl yardımcı olabilirim?", sortOrder: 1 },
            { label: "Teşekkürler", body: "Teşekkür ederiz!", sortOrder: 2 },
          ],
        },
      },
    });

    return NextResponse.json({ ok: true, organizationId: org.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Geçersiz form" }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Kayıt başarısız" }, { status: 500 });
  }
}
