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

/** Token + Phone Number ID'nin Meta tarafında geçerli olup olmadığını kontrol eder. */
export async function verifyCloudCredentials(params: {
  phoneNumberId: string;
  accessToken: string;
}): Promise<{ ok: true; displayPhone?: string } | { ok: false; error: string }> {
  try {
    const url = new URL(`${META_GRAPH}/${params.phoneNumberId}`);
    url.searchParams.set("fields", "display_phone_number,verified_name,quality_rating");
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${params.accessToken}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      return {
        ok: false,
        error: data?.error?.message ?? `Meta doğrulama hatası (${res.status})`,
      };
    }
    return {
      ok: true,
      displayPhone: data.display_phone_number
        ? String(data.display_phone_number).replace(/\D/g, "")
        : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Meta'ya ulaşılamadı",
    };
  }
}

export function verifyMetaWebhook(
  mode?: string | null,
  token?: string | null,
  challenge?: string | null,
) {
  const verifyToken = process.env.META_VERIFY_TOKEN ?? "wasys-verify-token";
  if (mode === "subscribe" && token === verifyToken) {
    return challenge ?? null;
  }
  return null;
}

/**
 * Meta imza doğrulama (X-Hub-Signature-256).
 * META_APP_SECRET yoksa doğrulama atlanır (geliştirme kolaylığı); production'da set edin.
 */
export async function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(received, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
  } catch {
    return false;
  }
}
