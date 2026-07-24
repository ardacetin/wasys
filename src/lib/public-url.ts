/**
 * Hostinger gibi proxy arkasında çalışan ortamlarda req.url iç adresi
 * (http://0.0.0.0:3000) gösterir. Yönlendirmelerde kullanıcının gördüğü
 * genel adresi üretmek için AUTH_URL / forwarded başlıkları tercih edilir.
 */
export function publicUrl(path: string, req: Request) {
  const envUrl = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (envUrl) {
    try {
      return new URL(path, new URL(envUrl).origin);
    } catch {
      // geçersiz env değeri — aşağıdaki yollara düş
    }
  }

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host && !host.startsWith("0.0.0.0") && !host.startsWith("127.0.0.1")) {
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    return new URL(path, `${proto}://${host}`);
  }

  return new URL(path, req.url);
}
