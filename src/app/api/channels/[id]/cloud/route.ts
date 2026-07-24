import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyCloudCredentials } from "@/lib/wa-cloud";

/** Cloud kanalı için token yeniden doğrulama / bağlama */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const channel = await prisma.channel.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
      type: "WHATSAPP_CLOUD",
    },
  });
  if (!channel) {
    return NextResponse.json({ error: "Cloud kanalı bulunamadı" }, { status: 404 });
  }
  if (!channel.metaPhoneId || !channel.metaToken) {
    return NextResponse.json(
      { error: "Phone Number ID veya Access Token eksik" },
      { status: 400 },
    );
  }

  const verify = await verifyCloudCredentials({
    phoneNumberId: channel.metaPhoneId,
    accessToken: channel.metaToken,
  });
  if (!verify.ok) {
    const updated = await prisma.channel.update({
      where: { id: channel.id },
      data: { status: "ERROR", lastError: verify.error },
    });
    return NextResponse.json({ error: verify.error, channel: updated }, { status: 400 });
  }

  const updated = await prisma.channel.update({
    where: { id: channel.id },
    data: {
      status: "CONNECTED",
      connectedAt: new Date(),
      lastError: null,
      phoneNumber: channel.phoneNumber || verify.displayPhone || null,
    },
  });

  return NextResponse.json({ channel: updated });
}
