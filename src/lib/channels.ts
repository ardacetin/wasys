import { prisma } from "@/lib/db";
import { waGateway } from "@/lib/wa-gateway";

type QrChannel = {
  id: string;
  status: string;
  phoneNumber: string | null;
  sessionId: string | null;
  qrData: string | null;
  createdAt: Date;
};

function qrKeeperScore(channel: QrChannel) {
  let score = 0;
  if (channel.status === "CONNECTED") score += 1000;
  if (channel.status === "QR_PENDING" || channel.status === "CONNECTING") {
    score += 500;
  }
  if (channel.phoneNumber) score += 50;
  if (channel.qrData) score += 25;
  return score;
}

/**
 * Organizasyon başına tek WHATSAPP_QR kanalı bırak.
 * Çalışan / bağlanan kanalı koru; fazla (hata/boş) kanalları sil.
 */
export async function enforceSingleQrChannel(organizationId: string) {
  const qrChannels = await prisma.channel.findMany({
    where: { organizationId, type: "WHATSAPP_QR" },
    orderBy: { createdAt: "asc" },
  });

  if (qrChannels.length <= 1) {
    return { keeper: qrChannels[0] ?? null, removed: 0 };
  }

  const keeper = [...qrChannels].sort((a, b) => {
    const diff = qrKeeperScore(b) - qrKeeperScore(a);
    if (diff !== 0) return diff;
    return a.createdAt.getTime() - b.createdAt.getTime();
  })[0];

  const extras = qrChannels.filter((c) => c.id !== keeper.id);

  for (const ch of extras) {
    if (ch.sessionId) {
      try {
        await waGateway.stopSession(ch.sessionId);
      } catch {
        /* gateway yoksa yine de DB temizliği yapılsın */
      }
    }
  }

  await prisma.channel.deleteMany({
    where: { id: { in: extras.map((c) => c.id) } },
  });

  return { keeper, removed: extras.length };
}

export async function countQrChannels(organizationId: string) {
  return prisma.channel.count({
    where: { organizationId, type: "WHATSAPP_QR" },
  });
}
