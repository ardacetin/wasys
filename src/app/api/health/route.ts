import { accessSync, constants, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { NextResponse } from "next/server";
import { ensureDatabaseReady, isMissingTableError, prisma } from "@/lib/db";
import { platformAdminEmails } from "@/lib/platform-admin";
import {
  getGatewayLastError,
  getGatewayLoaderId,
  isGatewayReady,
  probeGateway,
} from "@/lib/wa-gateway";

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return `${email.slice(0, 2)}***`;
  const visible = local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
}

async function platformAdminDiagnostics() {
  const emails = platformAdminEmails();
  const password = process.env.PLATFORM_ADMIN_PASSWORD || "";

  const looksLikeEmail = emails.length > 0 && emails.every((e) => e.includes("@"));
  let adminUserExists: boolean | null = null;
  let adminUserRole: string | null = null;
  if (emails.length > 0) {
    try {
      const user = await prisma.user.findFirst({
        where: { email: { in: emails } },
        select: { role: true },
      });
      adminUserExists = Boolean(user);
      adminUserRole = user?.role ?? null;
    } catch {
      adminUserExists = null;
    }
  }

  return {
    emailsConfigured: emails.length,
    maskedEmails: emails.map(maskEmail),
    emailsLookValid: emails.length > 0 ? looksLikeEmail : null,
    passwordSet: Boolean(password),
    passwordLongEnough: password ? password.length >= 12 : null,
    adminUserExists,
    adminUserRole,
  };
}

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

export async function GET(req: Request) {
  const hasAuthSecret = Boolean(
    (process.env.AUTH_SECRET && process.env.AUTH_SECRET.trim()) ||
      (process.env.NEXTAUTH_SECRET && process.env.NEXTAUTH_SECRET.trim()),
  );
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL?.trim());
  const authUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL || null;
  const sqlite = sqliteDiagnostics();
  const url = new URL(req.url);
  const warmupGateway = url.searchParams.get("warmup") !== "0";

  let databaseConnected = false;
  let userCount: number | null = null;
  const selfHeal: { attempted: boolean; succeeded: boolean | null } = {
    attempted: false,
    succeeded: null,
  };
  let databaseError: {
    name: string;
    code: string | null;
    message: string | null;
  } | null = null;

  const describeError = (error: unknown) => {
    console.error("[WASYS Health] database readiness check failed", error);
    return {
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
  };

  if (hasDatabaseUrl) {
    try {
      userCount = await prisma.user.count();
      databaseConnected = true;
    } catch (error) {
      if (isMissingTableError(error)) {
        // Tables missing → apply prisma/init.sql through the running Prisma
        // client (in-process, same DB file) and create the platform admin.
        selfHeal.attempted = true;
        selfHeal.succeeded = await ensureDatabaseReady();
        if (selfHeal.succeeded) {
          try {
            userCount = await prisma.user.count();
            databaseConnected = true;
          } catch (retryError) {
            databaseError = describeError(retryError);
          }
        } else {
          databaseError = describeError(error);
        }
      } else {
        databaseError = describeError(error);
      }
    }
  }

  const platformAdmin = databaseConnected
    ? await platformAdminDiagnostics()
    : null;

  const ok = hasAuthSecret && hasDatabaseUrl && databaseConnected;

  let adminHint: string | undefined;
  if (platformAdmin) {
    if (platformAdmin.emailsConfigured === 0) {
      adminHint =
        "PLATFORM_ADMIN_EMAILS boş. Hostinger .env dosyasına PLATFORM_ADMIN_EMAILS=arda@wasys.pro ekleyip Restart edin.";
    } else if (platformAdmin.emailsLookValid === false) {
      adminHint =
        "PLATFORM_ADMIN_EMAILS geçerli bir e-posta değil (şablon yer tutucusu kalmış olabilir). Gerçek e-postanızı yazıp Restart edin.";
    } else if (!platformAdmin.passwordSet || platformAdmin.passwordLongEnough === false) {
      adminHint =
        "PLATFORM_ADMIN_PASSWORD eksik veya 12 karakterden kısa. En az 12 karakterlik bir şifre yazıp Restart edin; bootstrap admin şifresini bu değere günceller.";
    } else if (platformAdmin.adminUserExists === false) {
      adminHint =
        "Admin kullanıcısı henüz oluşmamış. Restart / Redeploy edin (bootstrap PLATFORM_ADMIN_EMAILS için hesabı oluşturur).";
    }
  }

  const sqlitePath = typeof sqlite === "object" && sqlite && "path" in sqlite
    ? String((sqlite as { path?: string | null }).path ?? "")
    : "";
  const dbInsideDeploy = sqlitePath.includes("/nodejs/");

  let persistenceHint: string | undefined;
  if (dbInsideDeploy) {
    persistenceHint =
      "UYARI: Veritabanı nodejs/ içinde — Redeploy siler. .env'e WASYS_DATA_DIR=/home/u781807728/wasys-data ve DATABASE_URL=file:/home/u781807728/wasys-data/prod.db yazıp Restart edin.";
  }

  const gatewayProbe = warmupGateway
    ? await probeGateway(15000)
    : {
        ready: isGatewayReady(),
        error: getGatewayLastError(),
        warmed: false,
      };

  const smtpConfigured = Boolean(
    process.env.SMTP_HOST?.trim() &&
      process.env.SMTP_USER?.trim() &&
      process.env.SMTP_PASS?.trim(),
  );

  return NextResponse.json(
    {
      ok,
      checks: {
        AUTH_SECRET: hasAuthSecret,
        DATABASE_URL: hasDatabaseUrl,
        DATABASE_CONNECTED: databaseConnected,
        AUTH_URL: Boolean(authUrl),
        PERSISTENT_DB: databaseConnected ? !dbInsideDeploy : null,
        WHATSAPP_GATEWAY: gatewayProbe.ready,
        SMTP: smtpConfigured,
      },
      database: {
        userCount,
        error: databaseError,
        selfHeal,
        sqlite,
        wasysDataDir: process.env.WASYS_DATA_DIR ?? null,
      },
      platformAdmin,
      whatsappGateway: {
        ready: gatewayProbe.ready,
        warmed: gatewayProbe.warmed,
        loaderId: getGatewayLoaderId(),
        lastError: gatewayProbe.error ?? getGatewayLastError(),
        hint: gatewayProbe.ready
          ? null
          : gatewayProbe.error ??
            "Gateway hazır değil. ?warmup=1 ile health'i yenileyin veya Kanallar → QR ile bağlan deneyin. Entry file=server.js.",
      },
      smtp: {
        configured: smtpConfigured,
        host: process.env.SMTP_HOST ? String(process.env.SMTP_HOST) : null,
      },
      authUrlHint: authUrl ? authUrl.replace(/^(https?:\/\/[^/]+).*/, "$1") : null,
      hint: !hasAuthSecret
        ? "Create a .env file in the Hostinger nodejs/ folder with AUTH_SECRET=... then Restart the app."
        : !databaseConnected
          ? databaseError?.code === "P2021"
            ? "Tablolar yok ve otomatik onarım (init.sql) başarısız oldu. Bu sayfayı yenileyin; olmazsa health.database.error mesajına bakın ve Redeploy edin."
            : "SQLite açılamıyor. DATABASE_URL=file:/home/u781807728/wasys-data/prod.db; mkdir -p /home/u781807728/wasys-data; Entry file=server.js; Redeploy."
          : !gatewayProbe.ready
            ? `WhatsApp gateway hazır değil: ${gatewayProbe.error ?? "bilinmeyen hata"}. Hostinger loglarında [WASYS] satırlarına bakın.`
            : persistenceHint ?? adminHint,
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
