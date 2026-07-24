import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const hasAuthSecret = Boolean(
    (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim()) ||
      (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.trim()),
  );
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || null;

  let databaseConnected = false;
  let userCount: number | null = null;
  let databaseError: { name: string; code: string | null } | null = null;

  if (hasDatabaseUrl) {
    try {
      userCount = await prisma.user.count();
      databaseConnected = true;
    } catch (error) {
      console.error("[WASYS Health] database readiness check failed", error);
      databaseError = {
        name: error instanceof Error ? error.name : "UnknownError",
        code:
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          typeof error.code === "string"
            ? error.code
            : null,
      };
    }
  }

  const ok = hasAuthSecret && hasDatabaseUrl && databaseConnected;

  return NextResponse.json(
    {
      ok,
      checks: {
        AUTH_SECRET: hasAuthSecret,
        DATABASE_URL: hasDatabaseUrl,
        DATABASE_CONNECTED: databaseConnected,
        AUTH_URL: Boolean(authUrl),
      },
      database: {
        userCount,
        error: databaseError,
      },
      authUrlHint: authUrl ? authUrl.replace(/^(https?:\/\/[^/]+).*/, "$1") : null,
      hint: !hasAuthSecret
        ? "Create a .env file in the Hostinger nodejs/ folder with AUTH_SECRET=... then Restart the app."
        : !databaseConnected
          ? "SQLite açılamıyor (Error 14). DATABASE_URL=file:/home/u781807728/domains/wasys.pro/nodejs/data/prod.db yapın, nodejs/data oluşturun, Entry file=server.js, Redeploy."
        : undefined,
    },
    { status: ok ? 200 : 503 },
  );
}
