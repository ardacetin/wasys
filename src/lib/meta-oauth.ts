import { createHmac, timingSafeEqual } from "node:crypto";

export const META_GRAPH = "https://graph.facebook.com/v21.0";

export type MetaPhoneOption = {
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string;
  verifiedName: string;
};

function appSecret() {
  return process.env.META_APP_SECRET?.trim() ?? "";
}

export function metaAppId() {
  return process.env.META_APP_ID?.trim() ?? "";
}

export function metaConfigId() {
  return process.env.META_EMBEDDED_SIGNUP_CONFIG_ID?.trim() ?? "";
}

export function metaOAuthConfigured() {
  return Boolean(metaAppId() && appSecret());
}

export function metaRedirectUri() {
  const base = (
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL ||
    "https://wasys.pro"
  ).replace(/\/$/, "");
  return (
    process.env.META_OAUTH_REDIRECT_URI?.trim() ||
    `${base}/api/meta/oauth/callback`
  );
}

function stateSecret() {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    appSecret() ||
    "wasys-meta-state"
  );
}

export function signMetaState(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyMetaState(state: string): Record<string, unknown> | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.exp === "number" && Date.now() > parsed.exp) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildFacebookOAuthUrl(state: string) {
  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("redirect_uri", metaRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    [
      "whatsapp_business_management",
      "whatsapp_business_messaging",
      "business_management",
    ].join(","),
  );
  return url.toString();
}

export async function exchangeCodeForToken(code: string, redirectUri?: string) {
  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", appSecret());
  url.searchParams.set("redirect_uri", redirectUri || metaRedirectUri());
  url.searchParams.set("code", code);

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error?.message ?? "Facebook token alınamadı");
  }
  return String(data.access_token);
}

/** Embedded Signup code exchange (redirect_uri yok). */
export async function exchangeEmbeddedSignupCode(code: string) {
  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", appSecret());
  url.searchParams.set("code", code);

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data?.error?.message ?? "Embedded Signup token alınamadı");
  }
  return String(data.access_token);
}

export async function exchangeLongLivedToken(shortLivedToken: string) {
  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", metaAppId());
  url.searchParams.set("client_secret", appSecret());
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    // Kısa ömürlü token ile devam et
    return shortLivedToken;
  }
  return String(data.access_token);
}

async function graphGet<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${META_GRAPH}${path.startsWith("/") ? path : `/${path}`}`);
  url.searchParams.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Meta Graph hatası (${res.status})`);
  }
  return data as T;
}

export async function discoverWhatsAppPhones(
  accessToken: string,
): Promise<MetaPhoneOption[]> {
  const options: MetaPhoneOption[] = [];
  const seen = new Set<string>();

  const businesses = await graphGet<{ data?: Array<{ id: string; name?: string }> }>(
    "/me/businesses",
    accessToken,
    { fields: "id,name", limit: "50" },
  ).catch(() => ({ data: [] as Array<{ id: string }> }));

  const businessIds = (businesses.data ?? []).map((b) => b.id);

  // Bazı tokenlarda /me üzerinden de WABA gelebilir
  const meWabas = await graphGet<{
    data?: Array<{ id: string }>;
  }>("/me", accessToken, {
    fields: "id",
  }).catch(() => null);
  void meWabas;

  for (const businessId of businessIds) {
    for (const edge of [
      "owned_whatsapp_business_accounts",
      "client_whatsapp_business_accounts",
    ] as const) {
      const wabas = await graphGet<{ data?: Array<{ id: string }> }>(
        `/${businessId}/${edge}`,
        accessToken,
        { fields: "id", limit: "50" },
      ).catch(() => ({ data: [] as Array<{ id: string }> }));

      for (const waba of wabas.data ?? []) {
        const phones = await graphGet<{
          data?: Array<{
            id: string;
            display_phone_number?: string;
            verified_name?: string;
          }>;
        }>(`/${waba.id}/phone_numbers`, accessToken, {
          fields: "id,display_phone_number,verified_name",
          limit: "50",
        }).catch(() => ({ data: [] }));

        for (const phone of phones.data ?? []) {
          if (seen.has(phone.id)) continue;
          seen.add(phone.id);
          options.push({
            phoneNumberId: phone.id,
            wabaId: waba.id,
            displayPhone: String(phone.display_phone_number ?? "").replace(/\D/g, ""),
            verifiedName: phone.verified_name ?? "WhatsApp Cloud",
          });
        }
      }
    }
  }

  // Debug token granular scopes bazen doğrudan WABA verir
  if (options.length === 0) {
    const debug = await graphGet<{
      data?: { granular_scopes?: Array<{ scope: string; target_ids?: string[] }> };
    }>("/debug_token", accessToken, {
      input_token: accessToken,
    }).catch(() => null);

    const wabaIds =
      debug?.data?.granular_scopes?.flatMap((s) => s.target_ids ?? []) ?? [];

    for (const wabaId of [...new Set(wabaIds)]) {
      const phones = await graphGet<{
        data?: Array<{
          id: string;
          display_phone_number?: string;
          verified_name?: string;
        }>;
      }>(`/${wabaId}/phone_numbers`, accessToken, {
        fields: "id,display_phone_number,verified_name",
      }).catch(() => ({ data: [] }));

      for (const phone of phones.data ?? []) {
        if (seen.has(phone.id)) continue;
        seen.add(phone.id);
        options.push({
          phoneNumberId: phone.id,
          wabaId,
          displayPhone: String(phone.display_phone_number ?? "").replace(/\D/g, ""),
          verifiedName: phone.verified_name ?? "WhatsApp Cloud",
        });
      }
    }
  }

  return options;
}

export async function subscribeAppToWaba(wabaId: string, accessToken: string) {
  const url = new URL(`${META_GRAPH}/${wabaId}/subscribed_apps`);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn("[WASYS meta] WABA subscribe failed", data);
  }
  return res.ok;
}

export async function registerCloudPhoneNumber(
  phoneNumberId: string,
  accessToken: string,
  pin = "000000",
) {
  const url = new URL(`${META_GRAPH}/${phoneNumberId}/register`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      pin,
    }),
  });
  const data = await res.json().catch(() => ({}));
  // Zaten kayıtlıysa hata dönebilir — kritik değil
  if (!res.ok) {
    console.warn("[WASYS meta] phone register:", data?.error?.message ?? res.status);
  }
  return res.ok;
}

export async function fetchPhoneDisplay(
  phoneNumberId: string,
  accessToken: string,
) {
  const data = await graphGet<{
    display_phone_number?: string;
    verified_name?: string;
  }>(`/${phoneNumberId}`, accessToken, {
    fields: "display_phone_number,verified_name",
  });
  return {
    displayPhone: String(data.display_phone_number ?? "").replace(/\D/g, ""),
    verifiedName: data.verified_name ?? "WhatsApp Cloud",
  };
}
