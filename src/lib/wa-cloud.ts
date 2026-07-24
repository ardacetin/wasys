const META_GRAPH = "https://graph.facebook.com/v21.0";

export type CloudSendResult = {
  externalId: string;
};

export async function sendCloudText(params: {
  phoneNumberId: string;
  accessToken: string;
  to: string;
  text: string;
}): Promise<CloudSendResult> {
  const res = await fetch(`${META_GRAPH}/${params.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: params.to.replace(/\D/g, ""),
      type: "text",
      text: { body: params.text },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? "Cloud API send failed");
  }

  return { externalId: data.messages?.[0]?.id ?? `cloud_${Date.now()}` };
}

export function verifyMetaWebhook(mode?: string | null, token?: string | null, challenge?: string | null) {
  const verifyToken = process.env.META_VERIFY_TOKEN ?? "wasys-verify-token";
  if (mode === "subscribe" && token === verifyToken) {
    return challenge ?? null;
  }
  return null;
}
