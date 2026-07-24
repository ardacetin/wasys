import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { publicUrl } from "@/lib/public-url";

/**
 * Lightweight cookie check only — do NOT call Auth.js here.
 * Hostinger Edge runtime often has no AUTH_SECRET; calling auth() spams MissingSecret.
 * Real session verification happens in server layouts / API routes.
 */
function hasSessionCookie(req: NextRequest) {
  return Boolean(
    req.cookies.get("authjs.session-token")?.value ||
      req.cookies.get("__Secure-authjs.session-token")?.value ||
      req.cookies.get("next-auth.session-token")?.value ||
      req.cookies.get("__Secure-next-auth.session-token")?.value,
  );
}

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isLoggedIn = hasSessionCookie(req);

  // Bypass broken CDN-cached RSC on old App Router /login
  if (path === "/login" || path === "/register" || path === "/kayit") {
    return NextResponse.redirect(publicUrl("/giris" + req.nextUrl.search, req), 307);
  }

  const isAuthPage = path === "/giris";
  const isProtected =
    path.startsWith("/admin") ||
    path.startsWith("/inbox") ||
    path.startsWith("/crm") ||
    path.startsWith("/settings") ||
    path.startsWith("/reports");

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(publicUrl("/giris", req));
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(publicUrl("/panel", req));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/inbox/:path*",
    "/crm/:path*",
    "/admin/:path*",
    "/settings/:path*",
    "/reports/:path*",
    "/login",
    "/register",
    "/giris",
    "/kayit",
  ],
};
