import { NextResponse } from "next/server";

export async function GET() {
  const hasAuthSecret = Boolean(
    (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim()) ||
      (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.trim()),
  );
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || null;

  const ok = hasAuthSecret && hasDatabaseUrl;

  return NextResponse.json(
    {
      ok,
      checks: {
        AUTH_SECRET: hasAuthSecret,
        DATABASE_URL: hasDatabaseUrl,
        AUTH_URL: Boolean(authUrl),
      },
      authUrlHint: authUrl ? authUrl.replace(/^(https?:\/\/[^/]+).*/, "$1") : null,
      hint: !hasAuthSecret
        ? "Create a .env file in the Hostinger nodejs/ folder with AUTH_SECRET=... then Restart the app."
        : undefined,
    },
    { status: ok ? 200 : 503 },
  );
}
