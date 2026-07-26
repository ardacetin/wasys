/**
 * Next.js sunucu açılışında bir kez çalışır (Entry file server.js olmasa bile).
 * WhatsApp Baileys gateway'ini süreç içinde ayağa kaldırır.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  // server.js zaten wa-runtime + resumeSessions çalıştırır; burada ikinci kez
  // yüklemek listen() uyarısı ve gönderim/oturum uyumsuzluğuna yol açabiliyor.
  if (process.env.WASYS_GATEWAY_BOOT === "server.js") {
    try {
      await import("@/lib/gateway-webhook");
      console.log("[WASYS] instrumentation: webhook bridge only (gateway via server.js)");
    } catch (error) {
      console.warn("[WASYS] instrumentation: gateway-webhook bridge failed", error);
    }
    return;
  }

  try {
    const { ensureGateway } = await import("@/lib/wa-gateway");
    await ensureGateway();
    console.log("[WASYS] instrumentation: WhatsApp gateway registered");
  } catch (error) {
    console.error("[WASYS] instrumentation: gateway start failed", error);
  }
}
