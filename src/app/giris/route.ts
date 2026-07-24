import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HTML = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WASYS — Giriş</title>
  <style>
    :root { --bg:#f3efe6; --ink:#14201b; --muted:#5c6b64; --line:#d9d0c2; --brand:#0b6e4f; --danger:#b42318; --card:#fffdf8; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; color:var(--ink);
      background: radial-gradient(ellipse 80% 50% at 10% -10%, #d8efe6 0%, transparent 55%),
                  radial-gradient(ellipse 60% 40% at 100% 0%, #f7d7cb 0%, transparent 45%), var(--bg); }
    .card { width:100%; max-width:28rem; background:color-mix(in oklab, var(--card) 92%, transparent); border:1px solid var(--line);
      border-radius:1rem; padding:2rem; box-shadow:0 20px 50px rgba(20,32,27,.08); backdrop-filter: blur(8px); }
    .brand { font-size:1.5rem; font-weight:700; color:#084c37; letter-spacing:-0.02em; }
    h1 { margin:1.25rem 0 0; font-size:1.75rem; }
    p { color:var(--muted); font-size:.9rem; }
    label { display:block; font-size:.875rem; font-weight:600; margin-top:1rem; }
    input { width:100%; margin-top:.4rem; padding:.7rem .85rem; border:1px solid var(--line); border-radius:.75rem; font:inherit; background:#fff; }
    input:focus { outline:2px solid color-mix(in oklab, var(--brand) 45%, white); border-color:var(--brand); }
    button { width:100%; margin-top:1.25rem; padding:.75rem; border:0; border-radius:.75rem; background:var(--brand); color:#fff; font-weight:700; cursor:pointer; }
    button:disabled { opacity:.6; cursor:wait; }
    .err { color:var(--danger); font-size:.875rem; margin-top:.75rem; }
    .warn { margin-top:1rem; padding:.75rem; border-radius:.75rem; background:#fde8e8; color:var(--danger); font-size:.875rem; }
    .foot { margin-top:1.5rem; text-align:center; font-size:.875rem; color:var(--muted); }
    a { color:var(--brand); font-weight:700; text-decoration:none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">WASYS</div>
    <h1>Giriş yap</h1>
    <p>Ekip gelen kutunuza devam edin.</p>
    <div class="warn" style="background:#eef6f1;color:#084c37">
      Dışarıdan kayıt kapalıdır. Yeni hesaplar WASYS yöneticisi tarafından oluşturulur.
    </div>
    <div id="configWarn" class="warn" hidden>
      AUTH_SECRET eksik. Hostinger <code>nodejs/.env</code> dosyasını oluşturup uygulamayı Restart edin.
    </div>
    <form id="form">
      <label>E-posta
        <input name="email" type="email" required value="demo@wasys.app" autocomplete="username" />
      </label>
      <label>Şifre
        <input name="password" type="password" required value="demo1234" autocomplete="current-password" />
      </label>
      <div id="error" class="err" hidden></div>
      <button id="submit" type="submit">Giriş yap</button>
    </form>
    <div class="foot">Demo: <strong>demo@wasys.app</strong> / <strong>demo1234</strong></div>
  </div>
  <script>
    (function () {
      var params = new URLSearchParams(location.search);
      if (params.get('error') === 'Configuration') {
        document.getElementById('configWarn').hidden = false;
      }
      var form = document.getElementById('form');
      var errorEl = document.getElementById('error');
      var btn = document.getElementById('submit');
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        errorEl.hidden = true;
        btn.disabled = true;
        btn.textContent = 'Giriş yapılıyor...';
        try {
          var fd = new FormData(form);
          var csrfRes = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
          var csrfData = await csrfRes.json();
          if (!csrfRes.ok || csrfData.message) {
            throw new Error(csrfData.message || 'Auth yapılandırması hatalı (AUTH_SECRET).');
          }
          var body = new URLSearchParams({
            csrfToken: csrfData.csrfToken,
            email: String(fd.get('email') || ''),
            password: String(fd.get('password') || ''),
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
            var msg = 'E-posta veya şifre hatalı';
            if (resultUrl.indexOf('Configuration') !== -1 || String(data.message || '').toLowerCase().indexOf('configuration') !== -1) {
              msg = 'AUTH_SECRET eksik. Hostinger nodejs/.env dosyasını kontrol edin.';
            }
            throw new Error(msg);
          }
          location.assign(resultUrl);
        } catch (err) {
          errorEl.textContent = err && err.message ? err.message : 'Giriş başarısız';
          errorEl.hidden = false;
          btn.disabled = false;
          btn.textContent = 'Giriş yap';
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
