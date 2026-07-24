import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { publicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

// Giriş sonrası yönlendirme: SaaS süper admin platform paneline,
// müşteri kullanıcıları kendi gelen kutularına gider.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(publicUrl("/giris", req));
  }
  if (isPlatformAdmin(session.user.email)) {
    return NextResponse.redirect(publicUrl("/admin/accounts", req));
  }
  return NextResponse.redirect(publicUrl("/inbox", req));
}
