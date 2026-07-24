import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2];

if (mode !== "build" && mode !== "start" && mode !== "bootstrap") {
  console.error("Usage: node prisma/run-production.mjs <build|start|bootstrap>");
  process.exit(1);
}

// Hostinger SSH/runtime often has no `node`/`npx` on PATH. Child tools (Prisma)
// need the same Node binary that launched this script.
const nodeDir = dirname(process.execPath);
const env = {
  ...process.env,
  PATH: `${nodeDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`,
};

function bin(name) {
  const local = resolve(projectRoot, "node_modules", ".bin", name);
  if (!existsSync(local)) {
    throw new Error(`Missing ${local}. Run npm install in the Hostinger panel build first.`);
  }
  return local;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [resolve(projectRoot, "prisma/prepare-db.mjs")]);

if (mode === "build") {
  run(bin("prisma"), ["generate"]);
}

run(bin("prisma"), ["db", "push"]);
run(process.execPath, [resolve(projectRoot, "prisma/bootstrap.mjs")]);

if (mode === "build") {
  run(bin("next"), ["build"]);
} else if (mode === "start") {
  run(bin("next"), ["start"]);
}
