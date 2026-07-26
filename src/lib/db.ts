import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  accessSync,
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  __wasysSqliteReady?: boolean;
  __wasysSelfHeal?: Promise<boolean> | null;
};

/**
 * Hostinger often sets DATABASE_URL inside nodejs/ which Redeploy wipes.
 * Prefer /home/u781807728/wasys-data/prod.db (outside deploy tree).
 */
function ensureSqliteDatabaseUrl() {
  if (globalForPrisma.__wasysSqliteReady) return;
  globalForPrisma.__wasysSqliteReady = true;

  const configured = process.env.DATABASE_URL?.trim();
  if (configured && !configured.startsWith("file:")) return;

  const ensureWritable = (databasePath: string) => {
    const directory = dirname(databasePath);
    mkdirSync(directory, { recursive: true });
    accessSync(directory, constants.W_OK);
    try {
      accessSync(databasePath, constants.R_OK | constants.W_OK);
    } catch {
      const fd = openSync(databasePath, "a");
      closeSync(fd);
    }
  };

  const resolveSqlitePath = (databaseUrl: string) => {
    const raw = decodeURIComponent(
      databaseUrl.slice("file:".length).split("?")[0],
    );
    const configuredPath = raw
      .replace(/^\/\/\//, "/")
      .replace(/^\/\/[^/]*/, "");
    if (isAbsolute(configuredPath)) return configuredPath;
    return resolve(process.cwd(), "prisma", configuredPath);
  };

  const persistentRoot =
    process.env.WASYS_DATA_DIR?.trim() ||
    (existsSync("/home/u781807728")
      ? "/home/u781807728/wasys-data"
      : resolve(process.cwd(), "data"));
  const preferredPath = resolve(persistentRoot, "prod.db");

  // Eski nodejs/data dosyasını bir kez kalıcı yola kopyala
  const legacy = resolve(process.cwd(), "data", "prod.db");
  try {
    if (
      existsSync(legacy) &&
      statSync(legacy).size > 0 &&
      (!existsSync(preferredPath) || statSync(preferredPath).size === 0) &&
      resolve(legacy) !== resolve(preferredPath)
    ) {
      mkdirSync(persistentRoot, { recursive: true });
      copyFileSync(legacy, preferredPath);
      console.log(`[WASYS DB] Migrated ${legacy} → ${preferredPath}`);
    }
  } catch {
    // ignore migration errors
  }

  try {
    mkdirSync(persistentRoot, { recursive: true });
    accessSync(persistentRoot, constants.W_OK);

    let target = preferredPath;
    if (configured?.startsWith("file:")) {
      const databasePath = resolveSqlitePath(configured);
      const insideDeploy = databasePath.includes("/nodejs/");
      if (!insideDeploy) target = databasePath;
      else {
        console.warn(
          `[WASYS DB] DATABASE_URL under deploy tree (${databasePath}); using ${preferredPath}`,
        );
      }
    }

    ensureWritable(target);
    process.env.DATABASE_URL = `file:${target}`;
    process.env.WASYS_DATA_DIR = persistentRoot;
    if (!process.env.GATEWAY_DATA_DIR) {
      process.env.GATEWAY_DATA_DIR = persistentRoot;
    }
  } catch (error) {
    const fallbackPath = resolve(process.cwd(), "data", "prod.db");
    const reason = error instanceof Error ? error.message : String(error);
    console.error(
      `[WASYS DB] Cannot use persistent DB (${reason}). Falling back to ${fallbackPath}`,
    );
    ensureWritable(fallbackPath);
    process.env.DATABASE_URL = `file:${fallbackPath}`;
  }
}

ensureSqliteDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// Production'da da tek istemci — Hostinger uzun yaşayan Node sürecinde
// her import'ta yeni PrismaClient açılmasını engeller.
globalForPrisma.prisma = prisma;

/**
 * "The table `main.User` does not exist" → Prisma error P2021 (also P2010 when
 * raised through raw queries). Used to decide whether self-heal should run.
 */
export function isMissingTableError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? (error as { code?: unknown }).code : null;
  if (code === "P2021") return true;
  const message =
    error instanceof Error ? error.message : String((error as object) ?? "");
  return /table .* does not exist|no such table/i.test(message);
}

async function userTableExists(): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='User'",
  );
  return Array.isArray(rows) && rows.length > 0;
}

function readInitSqlStatements(): string[] {
  const initSqlPath = resolve(process.cwd(), "prisma", "init.sql");
  const sql = readFileSync(initSqlPath, "utf8");
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) =>
      // Drop chunks that only contain comments/whitespace.
      statement
        .split("\n")
        .some((line) => line.trim() && !line.trim().startsWith("--")),
    );
}

/**
 * Creates all tables from prisma/init.sql through the ALREADY RUNNING Prisma
 * client. No child processes, no CLI, no env drift: the DDL lands in exactly
 * the database file this app queries.
 */
async function applyInitSqlInProcess(): Promise<void> {
  const statements = readInitSqlStatements();
  let applied = 0;
  for (const statement of statements) {
    try {
      await prisma.$executeRawUnsafe(statement);
      applied += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/already exists/i.test(message)) continue;
      throw new Error(
        `init.sql statement failed: ${message.slice(0, 300)}\nStatement: ${statement.slice(0, 120)}`,
      );
    }
  }
  console.log(`[WASYS DB] init.sql applied in-process (${applied} statements)`);
}

/**
 * In-process equivalent of prisma/bootstrap.mjs: creates the demo organization
 * and the platform admin (PLATFORM_ADMIN_EMAILS + PLATFORM_ADMIN_PASSWORD) so
 * login works right after the tables appear. Idempotent.
 */
async function bootstrapPlatformAdminInProcess(): Promise<void> {
  let adminEmail = process.env.PLATFORM_ADMIN_EMAILS?.split(",")[0]
    ?.trim()
    ?.toLowerCase();
  const adminPassword = process.env.PLATFORM_ADMIN_PASSWORD;

  if (!adminEmail) {
    const existingOwner = await prisma.user.findFirst({
      where: { role: "OWNER" },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    adminEmail = existingOwner?.email ?? undefined;
  }
  if (!adminEmail || !adminEmail.includes("@")) {
    console.warn(
      "[WASYS DB] bootstrap skipped: PLATFORM_ADMIN_EMAILS missing or invalid",
    );
    return;
  }
  if (adminPassword && adminPassword.length < 12) {
    console.warn(
      "[WASYS DB] bootstrap skipped: PLATFORM_ADMIN_PASSWORD shorter than 12 chars",
    );
    return;
  }

  const organization = await prisma.organization.upsert({
    where: { slug: "wasys-demo" },
    update: { name: "WASYS Demo", plan: "STANDARD", maxUsers: 50 },
    create: {
      name: "WASYS Demo",
      slug: "wasys-demo",
      plan: "STANDARD",
      maxUsers: 50,
    },
  });

  // Eski Basic/Pro kayıtlarını tek pakete taşı
  await prisma.organization.updateMany({
    where: { plan: { in: ["BASIC", "PRO"] } },
    data: { plan: "STANDARD" },
  });

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { passwordHash: true },
  });
  if (!existingAdmin && !adminPassword) {
    console.warn(
      "[WASYS DB] bootstrap skipped: PLATFORM_ADMIN_PASSWORD must be set to create the admin for the first time",
    );
    return;
  }
  const passwordHash = adminPassword
    ? await hash(adminPassword, 12)
    : existingAdmin!.passwordHash;

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "WASYS Yönetici",
      passwordHash,
      role: "OWNER",
      organizationId: organization.id,
    },
    create: {
      email: adminEmail,
      name: "WASYS Yönetici",
      passwordHash,
      role: "OWNER",
      organizationId: organization.id,
    },
  });

  const existingChannel = await prisma.channel.findFirst({
    where: { organizationId: organization.id },
  });
  if (!existingChannel) {
    await prisma.channel.create({
      data: {
        organizationId: organization.id,
        name: "Ana WhatsApp",
        type: "WHATSAPP_QR",
        status: "DISCONNECTED",
        sessionId: `sess_${organization.id.slice(0, 8)}`,
      },
    });
  }

  const defaultTags = [
    { name: "Yeni Lead", color: "#128C7E" },
    { name: "Sipariş", color: "#25D366" },
    { name: "Destek", color: "#075E54" },
  ];
  for (const tag of defaultTags) {
    await prisma.tag.upsert({
      where: {
        organizationId_name: {
          organizationId: organization.id,
          name: tag.name,
        },
      },
      update: { color: tag.color },
      create: { ...tag, organizationId: organization.id },
    });
  }

  console.log(
    `[WASYS DB] platform admin ready (${adminEmail.slice(0, 2)}***)`,
  );
}

async function ensureContactWaJidColumn() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Contact" ADD COLUMN "waJid" TEXT`,
    );
    console.log("[WASYS DB] Contact.waJid column added");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // duplicate column = already migrated
    if (!/duplicate column|already exists/i.test(message)) {
      // ignore — table may not exist yet (init.sql path handles it)
    }
  }
}

async function ensureMessageCreatedAtIndex() {
  try {
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message"("createdAt")`,
    );
  } catch {
    /* ignore */
  }
}

async function runSelfHeal(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  // Self-heal only applies to SQLite. Other providers use real migrations.
  if (!databaseUrl?.startsWith("file:")) return false;

  if (await userTableExists()) {
    await ensureContactWaJidColumn();
    await ensureMessageCreatedAtIndex();
    // Tablolar tamamsa da admin şifresini her açılışta .env değerine eşitle.
    // (Eskiden bunu bootstrap.mjs alt süreci yapıyordu; Hostinger'da alt
    // süreçler başarısız olabildiği için artık süreç içinde yapılıyor.)
    await bootstrapPlatformAdminInProcess();
    return true;
  }

  console.log("[WASYS DB] Tables missing — applying init.sql in-process");
  await applyInitSqlInProcess();

  if (!(await userTableExists())) {
    throw new Error("init.sql applied but User table still missing");
  }

  await bootstrapPlatformAdminInProcess();
  return true;
}

/**
 * Deterministic self-heal: ensures tables + platform admin exist in the SAME
 * database file the running Prisma client uses. Memoized per process, but a
 * failure clears the memo so the next call (e.g. a /api/health refresh) retries.
 */
export function ensureDatabaseReady(): Promise<boolean> {
  if (!globalForPrisma.__wasysSelfHeal) {
    globalForPrisma.__wasysSelfHeal = runSelfHeal().catch((error) => {
      globalForPrisma.__wasysSelfHeal = null;
      console.error("[WASYS DB] self-heal failed", error);
      return false;
    });
  }
  return globalForPrisma.__wasysSelfHeal;
}

// Kick off the self-heal on first import so a plain Restart fixes an empty DB
// even if nobody visits /api/health. Skippable for tooling.
if (process.env.WASYS_SKIP_DB_PUSH !== "1") {
  void ensureDatabaseReady();
}
