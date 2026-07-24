import { NextResponse } from "next/server";

export async function GET() {
  const hasAuthSecret = Boolean(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
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
      // never echo secret values
      authUrlHint: authUrl ? authUrl.replace(/^(https?:\/\/[^/]+).*/, "$1") : null,
    },
    { status: ok ? 200 : 503 },
  );
}
