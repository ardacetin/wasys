import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { upsertCloudChannelFromMeta } from "@/lib/meta-cloud-channel";
import {
  exchangeEmbeddedSignupCode,
  exchangeLongLivedToken,
  fetchPhoneDisplay,
  metaAppId,
  metaConfigId,
  metaOAuthConfigured,
  verifyMetaState,
  type MetaPhoneOption,
} from "@/lib/meta-oauth";
import { isOrgAdmin } from "@/lib/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    configured: metaOAuthConfigured(),
    appId: metaAppId() || null,
    configId: metaConfigId() || null,
    canManage: isOrgAdmin(session.user.role),
    oauthStartUrl: "/api/meta/oauth/start",
  });
}

const embeddedSchema = z.object({
  mode: z.literal("embedded").optional(),
  code: z.string().min(1),
  phoneNumberId: z.string().min(1),
  wabaId: z.string().min(1),
});

const pickSchema = z.object({
  mode: z.literal("pick"),
  pickToken: z.string().min(1),
  phoneNumberId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isOrgAdmin(session.user.role)) {
    return NextResponse.json(
      { error: "Cloud bağlantısı için yönetici rolü gerekir" },
      { status: 403 },
    );
  }
  if (!metaOAuthConfigured()) {
    return NextResponse.json(
      { error: "META_APP_ID / META_APP_SECRET tanımlı değil" },
      { status: 503 },
    );
  }

  const body = await req.json();

  if (body?.mode === "pick") {
    const parsed = pickSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Geçersiz seçim" }, { status: 400 });
    }
    const state = verifyMetaState(parsed.data.pickToken);
    if (!state || state.orgId !== session.user.organizationId) {
      return NextResponse.json(
        { error: "Seçim oturumu geçersiz, Facebook ile yeniden bağlanın" },
        { status: 400 },
      );
    }
    const phones = (state.phones as MetaPhoneOption[] | undefined) ?? [];
    const phone = phones.find((p) => p.phoneNumberId === parsed.data.phoneNumberId);
    if (!phone || typeof state.token !== "string") {
      return NextResponse.json({ error: "Numara bulunamadı" }, { status: 400 });
    }
    const channel = await upsertCloudChannelFromMeta({
      organizationId: session.user.organizationId,
      accessToken: state.token,
      phone,
    });
    return NextResponse.json({ channel });
  }

  const parsed = embeddedSchema.safeParse({ ...body, mode: body.mode ?? "embedded" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Facebook dönüş verisi eksik" }, { status: 400 });
  }

  try {
    const shortToken = await exchangeEmbeddedSignupCode(parsed.data.code);
    const accessToken = await exchangeLongLivedToken(shortToken);

    let displayPhone = "";
    let verifiedName = "WhatsApp Cloud";
    try {
      const info = await fetchPhoneDisplay(parsed.data.phoneNumberId, accessToken);
      displayPhone = info.displayPhone;
      verifiedName = info.verifiedName;
    } catch {
      /* ignore */
    }

    const channel = await upsertCloudChannelFromMeta({
      organizationId: session.user.organizationId,
      accessToken,
      phone: {
        phoneNumberId: parsed.data.phoneNumberId,
        wabaId: parsed.data.wabaId,
        displayPhone,
        verifiedName,
      },
    });

    return NextResponse.json({ channel });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Facebook Cloud bağlantısı başarısız";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
