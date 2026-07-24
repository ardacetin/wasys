import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mailer";

/**
 * Baileys kısa süreli kopup yeniden bağlanır; her close olayında mail atmak spam olur.
 * Bağlantı geri gelirse iptal edilir; kalıcı kopmada (veya logout) gecikmeli gönderilir.
 */
const DEFAULT_DELAY_MS = 45_000;
const URGENT_DELAY_MS = 5_000;

const pending = new Map<string, ReturnType<typeof setTimeout>>();

export function cancelDisconnectAlert(channelId: string) {
  const timer = pending.get(channelId);
  if (timer) {
    clearTimeout(timer);
    pending.delete(channelId);
  }
}

export function scheduleDisconnectAlert(
  channelId: string,
  opts?: { urgent?: boolean },
) {
  cancelDisconnectAlert(channelId);
  const delay = opts?.urgent ? URGENT_DELAY_MS : DEFAULT_DELAY_MS;
  const timer = setTimeout(() => {
    pending.delete(channelId);
    void notifyDisconnectIfStillDown(channelId).catch((error) =>
      console.error("[WASYS] bağlantı kopma e-postası gönderilemedi", error),
    );
  }, delay);
  pending.set(channelId, timer);
}

async function notifyDisconnectIfStillDown(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: { organization: { select: { name: true, alertEmail: true } } },
  });
  if (!channel) return;
  // Gecikme sırasında yeniden bağlandıysa mail atma
  if (channel.status === "CONNECTED") return;

  let recipients: string[] = [];
  if (channel.organization.alertEmail?.trim()) {
    recipients = [channel.organization.alertEmail.trim()];
  } else {
    const admins = await prisma.user.findMany({
      where: {
        organizationId: channel.organizationId,
        role: { in: ["OWNER", "ADMIN"] },
      },
      select: { email: true },
    });
    recipients = admins.map((a) => a.email);
  }
  if (!recipients.length) return;

  const label = channel.phoneNumber
    ? `${channel.name} (${channel.phoneNumber})`
    : channel.name;

  await sendMail({
    to: recipients,
    subject: `WASYS uyarı: ${label} WhatsApp bağlantısı koptu`,
    text: [
      `Merhaba,`,
      ``,
      `${channel.organization.name} hesabınızdaki "${label}" kanalının WhatsApp bağlantısı kesildi.`,
      ``,
      `Mesaj alışverişinin durmaması için panele girip kanalı yeniden bağlayın:`,
      `https://wasys.pro/settings/channels`,
      ``,
      `QR bağlantısı: Kanallar sayfasından "Bağlan" deyip telefonunuzla QR kodu okutun.`,
      ``,
      `WASYS`,
    ].join("\n"),
  });
}
