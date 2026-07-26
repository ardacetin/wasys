import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { upsertCloudChannelFromMeta } from "@/lib/meta-cloud-channel";
import {
  discoverWhatsAppPhones,
  exchangeCodeForToken,
  exchangeLongLivedToken,
  metaRedirectUri,
  signMetaState,
  verifyMetaState,
} from "@/lib/meta-oauth";

function appBase() {
  return (process.env.AUTH_URL || process.env.NEXTAUTH_URL || "https://wasys.pro").replace(
    /\/$/,
    "",
  );
}

function redirectChannels(query: Record<string, string>) {
  const url = new URL("/settings/channels", appBase());
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.redirect(new URL("/giris", appBase()));
  }

  const params = req.nextUrl.searchParams;
  const err = params.get("error_description") || params.get("error");
  if (err) {
    return redirectChannels({ meta_error: err });
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    return redirectChannels({ meta_error: "Facebook yetkilendirme eksik" });
  }

  const parsed = verifyMetaState(state);
  if (!parsed || parsed.orgId !== session.user.organizationId) {
    return redirectChannels({ meta_error: "Oturum doğrulanamadı, tekrar deneyin" });
  }

  try {
    const shortToken = await exchangeCodeForToken(code, metaRedirectUri());
    const accessToken = await exchangeLongLivedToken(shortToken);
    const phones = await discoverWhatsAppPhones(accessToken);

    if (phones.length === 0) {
      return redirectChannels({
        meta_error:
          "WhatsApp Business numarası bulunamadı. Meta’da WABA ve telefon ekleyip tekrar bağlanın.",
      });
    }

    if (phones.length === 1) {
      await upsertCloudChannelFromMeta({
        organizationId: session.user.organizationId,
        accessToken,
        phone: phones[0]!,
      });
      return redirectChannels({ meta_ok: "1" });
    }

    // Birden fazla numara — seçim için imzalı paket
    const pick = signMetaState({
      orgId: session.user.organizationId,
      token: accessToken,
      phones,
      exp: Date.now() + 20 * 60 * 1000,
    });

    return redirectChannels({ meta_pick: pick });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Facebook bağlantısı başarısız";
    return redirectChannels({ meta_error: message });
  }
}
