import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SESSION = "70991a";
const INGEST =
  "http://127.0.0.1:7564/ingest/73f98173-af99-4fae-9637-d4196daffbf6";

/** Hostinger + local: stdout + wasys-data NDJSON (SSH: cat ~/wasys-data/debug-70991a.ndjson) */
export function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = "outbound",
) {
  const payload = {
    sessionId: SESSION,
    runId,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  // #region agent log
  fetch(INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
  console.log(`[WASYS-DEBUG-${SESSION}]`, JSON.stringify(payload));
  try {
    const root =
      process.env.WASYS_DATA_DIR?.trim() ||
      process.env.GATEWAY_DATA_DIR?.trim() ||
      join(process.cwd(), "data");
    mkdirSync(root, { recursive: true });
    appendFileSync(
      join(root, "debug-70991a.ndjson"),
      `${JSON.stringify(payload)}\n`,
    );
  } catch {
    /* ignore */
  }
  // #endregion
}
