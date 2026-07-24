/**
 * ESM sarmalayıcı — `node prisma/persistent-paths.mjs` ile çalıştırılabilir.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { ensurePersistentDatabaseUrl } = require("./persistent-paths.cjs");

ensurePersistentDatabaseUrl();
