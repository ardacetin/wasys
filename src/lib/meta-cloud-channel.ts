import { prisma } from "@/lib/db";
import {
  fetchPhoneDisplay,
  registerCloudPhoneNumber,
  subscribeAppToWaba,
  type MetaPhoneOption,
} from "@/lib/meta-oauth";

export async function upsertCloudChannelFromMeta(params: {
  organizationId: string;
  accessToken: string;
  phone: MetaPhoneOption;
}) {
  const { organizationId, accessToken, phone } = params;

  await subscribeAppToWaba(phone.wabaId, accessToken);
  await registerCloudPhoneNumber(phone.phoneNumberId, accessToken);

  let displayPhone = phone.displayPhone;
  let verifiedName = phone.verifiedName;
  try {
    const info = await fetchPhoneDisplay(phone.phoneNumberId, accessToken);
    displayPhone = info.displayPhone || displayPhone;
    verifiedName = info.verifiedName || verifiedName;
  } catch {
    /* ignore */
  }

  const existing = await prisma.channel.findFirst({
    where: {
      organizationId,
      type: "WHATSAPP_CLOUD",
      metaPhoneId: phone.phoneNumberId,
    },
  });

  if (existing) {
    return prisma.channel.update({
      where: { id: existing.id },
      data: {
        name: verifiedName || existing.name,
        status: "CONNECTED",
        connectedAt: new Date(),
        metaToken: accessToken,
        metaWabaId: phone.wabaId,
        phoneNumber: displayPhone || existing.phoneNumber,
        lastError: null,
      },
    });
  }

  return prisma.channel.create({
    data: {
      organizationId,
      name: verifiedName || "WhatsApp Cloud",
      type: "WHATSAPP_CLOUD",
      status: "CONNECTED",
      connectedAt: new Date(),
      metaPhoneId: phone.phoneNumberId,
      metaToken: accessToken,
      metaWabaId: phone.wabaId,
      phoneNumber: displayPhone || null,
      lastError: null,
    },
  });
}
