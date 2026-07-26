import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildFacebookOAuthUrl,
  metaOAuthConfigured,
  signMetaState,
} from "@/lib/meta-oauth";
import { isOrgAdmin } from "@/lib/roles";

export async function GET() {
  const session = await auth();
  if (!session?.user?.organizationId) {
    return NextResponse.redirect(new URL("/giris", process.env.AUTH_URL ?? "https://wasys.pro"));
  }
  if (!isOrgAdmin(session.user.role)) {
    return NextResponse.redirect(
      new URL(
        "/settings/channels?meta_error=" +
          encodeURIComponent("Cloud bağlantısı için yönetici rolü gerekir"),
        process.env.AUTH_URL ?? "https://wasys.pro",
      ),
    );
  }
  if (!metaOAuthConfigured()) {
    return NextResponse.redirect(
      new URL(
        "/settings/channels?meta_error=" +
          encodeURIComponent(
            "META_APP_ID ve META_APP_SECRET .env içinde tanımlı değil",
          ),
        process.env.AUTH_URL ?? "https://wasys.pro",
      ),
    );
  }

  const state = signMetaState({
    orgId: session.user.organizationId,
    userId: session.user.id,
    exp: Date.now() + 15 * 60 * 1000,
  });

  return NextResponse.redirect(buildFacebookOAuthUrl(state));
}
