import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channels = await prisma.channel.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ channels });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const type = body.type === "WHATSAPP_CLOUD" ? "WHATSAPP_CLOUD" : "WHATSAPP_QR";

  const channel = await prisma.channel.create({
    data: {
      organizationId: session.user.organizationId,
      name: body.name ?? (type === "WHATSAPP_QR" ? "WhatsApp QR" : "WhatsApp Cloud"),
      type,
      status: "DISCONNECTED",
      sessionId: type === "WHATSAPP_QR" ? `sess_${Date.now().toString(36)}` : null,
      metaPhoneId: body.metaPhoneId ?? null,
      metaToken: body.metaToken ?? null,
      metaWabaId: body.metaWabaId ?? null,
      phoneNumber: body.phoneNumber ?? null,
    },
  });

  return NextResponse.json({ channel });
}
