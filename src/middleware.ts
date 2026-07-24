import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const path = req.nextUrl.pathname;
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
});

export const config = {
  matcher: ["/inbox/:path*", "/settings/:path*", "/reports/:path*", "/login", "/register"],
};
