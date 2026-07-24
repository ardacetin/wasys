import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
  const isAuthPage = path.startsWith("/login") || path.startsWith("/register");
  const isProtected =
    path.startsWith("/inbox") ||
    path.startsWith("/settings") ||
    path.startsWith("/reports");

  if (isProtected && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/inbox", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/inbox/:path*", "/settings/:path*", "/reports/:path*", "/login", "/register"],
};
