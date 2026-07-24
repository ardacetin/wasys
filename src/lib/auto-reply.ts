import { prisma } from "@/lib/db";

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // son 5 dk içinde panelde aktif olan
const AWAY_REPEAT_WINDOW_MS = 4 * 60 * 60 * 1000; // aynı sohbete 4 saatte bir

export function fillAutoMessage(
  body: string,
  contact: { name: string | null; phone: string },
) {
  const name = contact.name?.trim() || contact.phone;
  return body
    .replace(/\{\{\s*(ad|isim|name)\s*\}\}/gi, name)
    .replace(/\{\{\s*(telefon|phone)\s*\}\}/gi, contact.phone);
}

/** Organizasyonda şu anda panelde aktif (çevrimiçi) bir ekip üyesi var mı? */
export async function anyAgentOnline(organizationId: string) {
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  const count = await prisma.user.count({
    where: { organizationId, lastActiveAt: { gte: since } },
  });
  return count > 0;
}

/** Bu sohbete yakın zamanda meşgul mesajı gönderilmiş mi? (spam engeli) */
export async function awayMessageRecentlySent(
  conversationId: string,
  awayMessage: string,
) {
  const since = new Date(Date.now() - AWAY_REPEAT_WINDOW_MS);
  const existing = await prisma.message.findFirst({
    where: {
      conversationId,
      direction: "OUTBOUND",
      body: awayMessage,
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return Boolean(existing);
}
