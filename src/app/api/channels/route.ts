import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyCloudCredentials } from "@/lib/wa-cloud";

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

  if (type === "WHATSAPP_CLOUD") {
    const metaPhoneId = String(body.metaPhoneId ?? "").trim();
    const metaToken = String(body.metaToken ?? "").trim();
    if (!metaPhoneId || !metaToken) {
      return NextResponse.json(
        { error: "Phone Number ID ve Access Token zorunludur" },
        { status: 400 },
      );
    }

    const verify = await verifyCloudCredentials({
      phoneNumberId: metaPhoneId,
      accessToken: metaToken,
    });
    if (!verify.ok) {
      return NextResponse.json(
        { error: `Meta doğrulama başarısız: ${verify.error}` },
        { status: 400 },
      );
    }

    const channel = await prisma.channel.create({
      data: {
        organizationId: session.user.organizationId,
        name: body.name?.trim() || "WhatsApp Cloud",
        type: "WHATSAPP_CLOUD",
        status: "CONNECTED",
        connectedAt: new Date(),
        metaPhoneId,
        metaToken,
        metaWabaId: body.metaWabaId?.trim() || null,
        phoneNumber:
          String(body.phoneNumber ?? "").replace(/\D/g, "") ||
          verify.displayPhone ||
          null,
        lastError: null,
      },
    });

    return NextResponse.json({ channel });
  }

  const channel = await prisma.channel.create({
    data: {
      organizationId: session.user.organizationId,
      name: body.name ?? "WhatsApp QR",
      type: "WHATSAPP_QR",
      status: "DISCONNECTED",
      sessionId: `sess_${Date.now().toString(36)}`,
    },
  });

  return NextResponse.json({ channel });
}
