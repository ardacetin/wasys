import "dotenv/config";
import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

if (databaseUrl.startsWith("file:")) {
  const schemaDirectory = dirname(fileURLToPath(new URL("./schema.prisma", import.meta.url)));
  const configuredPath = decodeURIComponent(
    databaseUrl.slice("file:".length).split("?")[0],
  );
  const databasePath = isAbsolute(configuredPath)
    ? configuredPath
    : resolve(schemaDirectory, configuredPath);

  mkdirSync(dirname(databasePath), { recursive: true });
  console.log("SQLite data directory is ready");
}
