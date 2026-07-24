/**
 * Next.js sunucu açılışında bir kez çalışır (Entry file server.js olmasa bile).
 * WhatsApp Baileys gateway'ini süreç içinde ayağa kaldırır.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") {
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
