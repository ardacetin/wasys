import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

/**
 * Creates all tables from prisma/init.sql without needing the Prisma CLI.
 * Safe to re-run: skips when the User table already exists.
 */
const here = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.$queryRawUnsafe(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='User'",
  );
  if (Array.isArray(existing) && existing.length > 0) {
    console.log("[WASYS initsql] Tables already exist, skipping");
    return;
  }

  const sql = readFileSync(resolve(here, "init.sql"), "utf8");
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }

  console.log(`[WASYS initsql] Applied ${statements.length} statements`);
}

main()
  .catch((error) => {
    console.error("[WASYS initsql] failed", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
