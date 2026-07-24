import { accessSync, constants, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function sqliteDiagnostics() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || null;
  if (!databaseUrl?.startsWith("file:")) {
    return {
      kind: databaseUrl ? databaseUrl.split(":")[0] : null,
      path: null,
      dirExists: null,
      fileExists: null,
      dirWritable: null,
      cwd: process.cwd(),
    };
  }

  const raw = decodeURIComponent(databaseUrl.slice("file:".length).split("?")[0]);
  const configuredPath = raw.replace(/^\/\/\//, "/").replace(/^\/\/[^/]*/, "");
  const databasePath = isAbsolute(configuredPath)
    ? configuredPath
    : resolve(process.cwd(), "prisma", configuredPath);
  const directory = dirname(databasePath);

  let dirWritable: boolean | null = null;
  try {
    if (!existsSync(directory)) {
      mkdirSync(directory, { recursive: true });
    }
    accessSync(directory, constants.W_OK);
    dirWritable = true;
  } catch {
    dirWritable = false;
  }

  return {
    kind: "file",
    path: databasePath,
    dirExists: existsSync(directory),
    fileExists: existsSync(databasePath),
    fileBytes: existsSync(databasePath) ? statSync(databasePath).size : null,
    dirWritable,
    cwd: process.cwd(),
  };
}

export async function GET() {
  const hasAuthSecret = Boolean(
    (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim()) ||
      (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.trim()),
  );
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || null;
  const sqlite = sqliteDiagnostics();

  let databaseConnected = false;
  let userCount: number | null = null;
  let databaseError: {
    name: string;
    code: string | null;
    message: string | null;
  } | null = null;

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
        message: error instanceof Error ? error.message.slice(0, 300) : null,
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
        sqlite,
      },
      authUrlHint: authUrl ? authUrl.replace(/^(https?:\/\/[^/]+).*/, "$1") : null,
      hint: !hasAuthSecret
        ? "Create a .env file in the Hostinger nodejs/ folder with AUTH_SECRET=... then Restart the app."
        : !databaseConnected
          ? "SQLite Error 14: Entry file=server.js yapın; DATABASE_URL=file:/home/u781807728/domains/wasys.pro/nodejs/data/prod.db; nodejs/data klasörünü oluşturun; Redeploy. health.database.sqlite alanına bakın."
        : undefined,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
