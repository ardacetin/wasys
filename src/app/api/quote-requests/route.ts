import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";

const quoteSchema = z.object({
  fullName: z.string().trim().min(3, "Ad soyad en az 3 karakter olmalı").max(100),
  email: z.string().trim().email("Geçerli bir e-posta girin").max(160),
  phone: z
    .string()
    .trim()
    .min(10, "Geçerli bir telefon numarası girin")
    .max(24)
    .regex(/^[+()\d\s-]+$/, "Geçerli bir telefon numarası girin"),
  userCount: z.coerce.number().int().min(1).max(10_000),
  website: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  const parsed = quoteSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Lütfen form alanlarını kontrol edin.",
        fields: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const data = {
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone,
    userCount: parsed.data.userCount,
  };

  const recentDuplicate = await prisma.quoteRequest.findFirst({
    where: {
      email: data.email.toLowerCase(),
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
    select: { id: true },
  });

  if (recentDuplicate) {
    return NextResponse.json(
      { ok: true, message: "Talebiniz zaten alındı. En kısa sürede iletişime geçeceğiz." },
      { status: 200 },
    );
  }

  await prisma.quoteRequest.create({
    data: {
      ...data,
      email: data.email.toLowerCase(),
      plan: "STANDARD",
    },
  });

  return NextResponse.json(
    {
      ok: true,
      message: "Teklif talebiniz alındı. Ekibimiz en kısa sürede sizinle iletişime geçecek.",
    },
    { status: 201 },
  );
}
