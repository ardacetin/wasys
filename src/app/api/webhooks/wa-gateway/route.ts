import { NextResponse } from "next/server";
import { handleGatewayEvent } from "@/lib/gateway-webhook";

// Olay işleme mantığı src/lib/gateway-webhook.ts içinde: gateway aynı Node
// sürecinde çalıştığında olaylar HTTP'ye hiç uğramadan doğrudan o fonksiyona
// gider. Bu route, gateway ayrı süreçte (GATEWAY_MODE=http) çalıştığında veya
// dış istekler için HTTP giriş noktası olarak kalır.

function authorized(req: Request) {
  return req.headers.get("x-gateway-secret") === (process.env.GATEWAY_SECRET ?? "wasys-gateway-secret");
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json();
  const result = await handleGatewayEvent(payload);
  return NextResponse.json(result.body, { status: result.status });
}
