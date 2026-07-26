#!/usr/bin/env bash
# Hostinger SSH: PATH'te node yok; git repo da yok (deploy File Manager / Redeploy).
set -euo pipefail

for d in /opt/alt/alt-nodejs22/root/usr/bin /opt/alt/alt-nodejs20/root/usr/bin /opt/alt/alt-nodejs18/root/usr/bin; do
  if [[ -x "$d/node" ]]; then
    export PATH="$d:$PATH"
    break
  fi
done

if ! command -v node >/dev/null 2>&1; then
  echo "node bulunamadı. ls /opt/alt/alt-nodejs*/root/usr/bin/node" >&2
  exit 1
fi

ROOT="${1:-}"
if [[ -z "$ROOT" ]]; then
  if [[ -d "$HOME/domains/wasys.pro/nodejs" ]]; then
    ROOT="$HOME/domains/wasys.pro/nodejs"
  else
    ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  fi
fi
cd "$ROOT"

node scripts/ensure-baileys.cjs
echo "--- doğrulama ---"
test -f node_modules/long/package.json && echo "long OK" || echo "long EKSIK"
test -f node_modules/cacheable/package.json && echo "cacheable OK" || echo "cacheable EKSIK"
node --input-type=module <<'EOF'
import { pathToFileURL } from "node:url";
import { join } from "node:path";
const href = pathToFileURL(
  join(process.cwd(), "node_modules/@whiskeysockets/baileys/lib/index.js"),
).href;
await import(href);
console.log("Baileys ESM import OK");
EOF
