import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";

export const dynamic = "force-dynamic";

// Giriş sonrası yönlendirme: SaaS süper admin platform paneline,
// müşteri kullanıcıları kendi gelen kutularına gider.
export async function GET(req: Request) {
  const session = await auth();
  const base = new URL(req.url);
  if (!session?.user) {
    return NextResponse.redirect(new URL("/giris", base));
  }
  if (isPlatformAdmin(session.user.email)) {
    return NextResponse.redirect(new URL("/admin/accounts", base));
  }
  return NextResponse.redirect(new URL("/inbox", base));
}
