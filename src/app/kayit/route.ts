import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WASYS — Kayıt</title>
  <style>
    :root { --bg:#f3efe6; --ink:#14201b; --muted:#5c6b64; --line:#d9d0c2; --brand:#0b6e4f; --danger:#b42318; --card:#fffdf8; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; color:var(--ink);
      background: radial-gradient(ellipse 80% 50% at 10% -10%, #d8efe6 0%, transparent 55%),
                  radial-gradient(ellipse 60% 40% at 100% 0%, #f7d7cb 0%, transparent 45%), var(--bg); }
    .card { width:100%; max-width:28rem; background:color-mix(in oklab, var(--card) 92%, transparent); border:1px solid var(--line);
      border-radius:1rem; padding:2rem; box-shadow:0 20px 50px rgba(20,32,27,.08); }
    .brand { font-size:1.5rem; font-weight:700; color:#084c37; }
    h1 { margin:1.25rem 0 0; font-size:1.6rem; }
    p { color:var(--muted); font-size:.9rem; }
    label { display:block; font-size:.875rem; font-weight:600; margin-top:1rem; }
    input { width:100%; margin-top:.4rem; padding:.7rem .85rem; border:1px solid var(--line); border-radius:.75rem; font:inherit; background:#fff; }
    button { width:100%; margin-top:1.25rem; padding:.75rem; border:0; border-radius:.75rem; background:var(--brand); color:#fff; font-weight:700; cursor:pointer; }
    button:disabled { opacity:.6; }
    .err { color:var(--danger); font-size:.875rem; margin-top:.75rem; }
    .foot { margin-top:1.5rem; text-align:center; font-size:.875rem; color:var(--muted); }
    a { color:var(--brand); font-weight:700; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">WASYS</div>
    <h1>Organizasyon oluştur</h1>
    <p>Basic paket ile 5 kullanıcıya kadar başlayın.</p>
    <form id="form">
      <label>Şirket / marka <input name="organizationName" required /></label>
      <label>Adınız <input name="name" required /></label>
      <label>E-posta <input name="email" type="email" required /></label>
      <label>Şifre <input name="password" type="password" required minlength="6" /></label>
      <div id="error" class="err" hidden></div>
      <button id="submit" type="submit">Hesabı oluştur</button>
    </form>
    <div class="foot">Zaten hesabınız var mı? <a href="/giris">Giriş yap</a></div>
  </div>
  <script>
    (function () {
      var form = document.getElementById('form');
      var errorEl = document.getElementById('error');
      var btn = document.getElementById('submit');
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        errorEl.hidden = true;
        btn.disabled = true;
        btn.textContent = 'Oluşturuluyor...';
        try {
          var fd = new FormData(form);
          var payload = {
            organizationName: String(fd.get('organizationName') || ''),
            name: String(fd.get('name') || ''),
            email: String(fd.get('email') || ''),
            password: String(fd.get('password') || '')
          };
          var reg = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          var regData = await reg.json();
          if (!reg.ok) throw new Error(regData.error || 'Kayıt başarısız');

          var csrfRes = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
          var csrfData = await csrfRes.json();
          if (!csrfRes.ok || csrfData.message) throw new Error('Auth yapılandırması hatalı (AUTH_SECRET).');

          var body = new URLSearchParams({
            csrfToken: csrfData.csrfToken,
            email: payload.email,
            password: payload.password,
            callbackUrl: '/inbox',
            json: 'true'
          });
          var res = await fetch('/api/auth/callback/credentials', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-Auth-Return-Redirect': '1'
            },
            credentials: 'same-origin',
            body: body
          });
          var data = await res.json().catch(function () { return {}; });
          var resultUrl = String(data.url || '');
          if (!res.ok || !resultUrl || resultUrl.indexOf('error=') !== -1) {
            throw new Error('Kayıt oldu, giriş başarısız. /giris sayfasını deneyin.');
          }
          location.assign(resultUrl);
        } catch (err) {
          errorEl.textContent = err && err.message ? err.message : 'Kayıt başarısız';
          errorEl.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Hesabı oluştur';
        }
      });
    })();
  </script>
</body>
</html>`;

export async function GET() {
  return new NextResponse(HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      "CDN-Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
