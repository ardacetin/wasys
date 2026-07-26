# Hostinger (wasys.pro) — AUTH_SECRET kurulumu

Logdaki hata: `MissingSecret: Please define a secret`.

Hostinger panel Environment Variables çoğu zaman Next.js’e geçmiyor.
**Kesin çözüm:** uygulama klasörüne `.env` dosyası koy.

## Adımlar

1. hPanel → **Files** → **File Manager**
2. Git: `/home/u781807728/domains/wasys.pro/nodejs/`
3. **New File** → adı tam olarak: `.env`
4. Repodaki [`hostinger.env.txt`](../hostinger.env.txt) içeriğini yapıştır
5. Save
6. hPanel → Node.js → **Restart** (veya Redeploy)
7. Kontrol: https://wasys.pro/api/health  
   `"AUTH_SECRET": true` olmalı

## Yanlışlar

- `AUTH_SECRET="<değer>"` → tırnak koyma
- Sadece panelde yazıp Restart etmemek
- `.env` dosyasını `public/` altına koymak
- Dosya adı `.env.txt` olmak (`.env` olmalı)

## DB seed (ilk kurulum)

SSH veya Node terminal:

```bash
cd ~/domains/wasys.pro/nodejs
npm run db:bootstrap
```

`.env` / panelde SQLite yolu **yazılabilir** absolute path olmalı ve
**`nodejs/` dışında** olmalı (Redeploy `nodejs/` içeriğini siler):

```env
WASYS_DATA_DIR=/home/u781807728/wasys-data
DATABASE_URL=file:/home/u781807728/wasys-data/prod.db
GATEWAY_DATA_DIR=/home/u781807728/wasys-data
```

Eski `nodejs/data/prod.db` yolu Redeploy sonrası müşteri verilerini siler.
Uygulama açılışta eski dosyayı bir kez `wasys-data/` altına taşımaya çalışır.

## WhatsApp Cloud — Facebook ile bağla

Kanallar sayfasında token sormadan Facebook OAuth / Embedded Signup kullanılır.

1. [Meta for Developers](https://developers.facebook.com/) uygulaması oluşturun  
2. WhatsApp + Facebook Login for Business ekleyin  
3. **Valid OAuth Redirect URI**: `https://wasys.pro/api/meta/oauth/callback`  
4. **Allowed domains**: `wasys.pro`  
5. `.env` / panel:

```env
META_APP_ID=...
META_APP_SECRET=...
META_VERIFY_TOKEN=wasys-verify-token
# Opsiyonel Embedded Signup:
META_EMBEDDED_SIGNUP_CONFIG_ID=...
```

6. Webhook: `https://wasys.pro/api/webhooks/meta` + verify token  
7. Restart → Kanallar → **Facebook ile WhatsApp bağla**

## WhatsApp QR bağlantısı sık kopuyorsa

Baileys oturumu **Node süreci ayaktayken** canlı kalır. Kısa sürede düşmenin
yaygın nedenleri:

1. **Redeploy / Restart** — süreç ölünce soket iner (oturum dosyası kalır, genelde yeniden bağlanır).
2. **Aynı numara başka yerde** — WhatsApp Web / başka telefon / ikinci WASYS kanalı → `connectionReplaced`.
3. **`GATEWAY_DATA_DIR` yanlış** — oturum `nodejs/` içindeyse Redeploy siler. Olmalı:
   `GATEWAY_DATA_DIR=/home/u781807728/wasys-data`
4. Telefonda WhatsApp açık + internet; “Bağlı cihazlar”dan WASYS’i silmeyin.

Kontrol:

```bash
ls /home/u781807728/wasys-data/gateway-auth/
test -f /home/u781807728/wasys-data/gateway-sessions.json && echo registry OK
```

Gereksiz Redeploy yapmayın; yalnızca kod güncellemesinde Redeploy edin.

## WhatsApp / Baileys (`Cannot find package …` / `long` / `cacheable`)

Gateway `gateway/wa-runtime.mjs` üzerinden çalışır. Güncel sürüm işaretleri:

| Ne | Beklenen |
|----|----------|
| Gateway loader (log) | `wa-runtime-2026-07-26m` |
| ensure script (SSH çıktı) | `ensure-baileys script=ensure-baileys-2026-07-26m` |
| Baileys hazır satırı | `Baileys runtime deps hazır (ESM import OK)` |

**`wa-runtime-2026-07-26l`** veya **`Baileys runtime deps hazır (protobufjs, ws, …)`** görüyorsanız sunucuda **eski deploy** vardır. Hostinger’da **`git pull` çalışmaz** (`fatal: not a git repository`) — kod yalnızca hPanel **Redeploy** ile gelir.

### 1) Kodu güncelle (tercih)

1. hPanel → **Websites** → **Node.js** → wasys.pro
2. **Entry file** = `server.js`
3. **Build command** = `npm run build` (varsa)
4. **Redeploy** (Restart tek başına yeni `scripts/ensure-baileys.cjs` getirmez)
5. **Restart**
6. Log: `Baileys yüklendi (wa-runtime-2026-07-26m)`

`server.js` açılışta `scripts/ensure-baileys.cjs` çalıştırır: tam npm ağacı, ESM import testi, yedek `~/wasys-data/baileys-node_modules`.

### 2) Redeploy beklenemiyorsa — SSH (git yok)

```bash
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
cd ~/domains/wasys.pro/nodejs
bash scripts/hostinger-ensure-baileys.sh
```

Script yoksa (eski deploy):

```bash
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
cd ~/domains/wasys.pro/nodejs
TMP=$(mktemp -d)
npm install @whiskeysockets/baileys@6.7.22 --prefix "$TMP" --omit=dev --legacy-peer-deps --no-audit --no-fund
cp -a "$TMP"/node_modules/. ./node_modules/
rm -rf "$TMP"
test -f node_modules/long/package.json && echo "long OK"
node --input-type=module -e "import('file://$HOME/domains/wasys.pro/nodejs/node_modules/@whiskeysockets/baileys/lib/index.js').then(()=>console.log('import OK'))"
```

**Proje kökünde** `npm install` (next’i güncellemeye çalışan) Hostinger’da **ENOTEMPTY / 503** yapabilir — yalnızca `--prefix` + `cp` kullanın.

Bozuk kalıcı yedek:

```bash
rm -rf ~/wasys-data/baileys-node_modules
bash scripts/hostinger-ensure-baileys.sh
```

Sonra hPanel **Restart**.

### Eski notlar

Gateway Baileys’i `gateway/vendor/baileys` veya `node_modules/.../lib/index.js` mutlak yolundan yükler.

Hâlâ `@whiskeysockets/baileys` yoksa:

1. Entry file = `server.js`
2. Build command = `npm run build`
3. hPanel → **Redeploy**
4. SSH:

```bash
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
cd ~/domains/wasys.pro/nodejs
test -f gateway/wa-runtime.mjs && echo "runtime OK" || echo "ESKİ DEPLOY — Redeploy şart"
bash scripts/hostinger-ensure-baileys.sh
```

5. Restart; logda `wa-runtime-2026-07-26m` ve `Baileys yüklendi` arayın.

**Error 14 / Unable to open the database file** = klasör yok veya yazma izni yok.
File Manager veya SSH ile bir kez oluşturun:

```bash
mkdir -p /home/u781807728/wasys-data
```

Kontrol listesi:
1. `mkdir -p /home/u781807728/wasys-data` (SSH veya File Manager → home)
2. `.env` içinde yukarıdaki `WASYS_DATA_DIR` + `DATABASE_URL` (panel **ve** `nodejs/.env`)
3. hPanel Node.js → **Application startup file / Entry file** = `server.js`
   (Hostinger’da `npm start` alanı olmayabilir — entry file kullan)
4. Build command varsa: `npm run build`
5. Redeploy / Restart
6. https://wasys.pro/api/health → `DATABASE_CONNECTED: true` ve sqlite.path `wasys-data` içermeli

### SSH’te `npm: command not found`

Hostinger SSH PATH’inde npm yok. Önce Node sürümünü bul:

```bash
ls /opt/alt/alt-nodejs*/root/usr/bin/npm
```

Sonra (örnek Node 22):

```bash
export PATH="/opt/alt/alt-nodejs22/root/usr/bin:$PATH"
cd ~/domains/wasys.pro/nodejs
mkdir -p data
node prisma/run-production.mjs bootstrap
```

`npx` kullanma — Hostinger’da çoğu zaman yoktur. Yerel binary:
`./node_modules/.bin/prisma`

En kolayı yine de: File Manager’da `data` + doğru `DATABASE_URL`, sonra panelden **Redeploy**.

`prepare-db.mjs` klasörü oluşturur; yazamazsa otomatik `nodejs/data/prod.db`’ye düşer.
Start/build aynı process env ile `prisma db push` + bootstrap çalıştırır.

## Otomatik onarım (self-heal)

`server.js` artık `.env` dosyasını kendisi yükler, SQLite yolunu normalize eder
ve başlangıçta loglara `[WASYS] SQLite database: file:...` satırını yazar —
`db push`un hangi dosyaya çalıştığını buradan doğrulayabilirsiniz.

Ayrıca uygulama, tabloların eksik olduğunu görürse (`P2021`) **kendi içinde**
`prisma/init.sql`'i çalışan Prisma client üzerinden uygular ve
`PLATFORM_ADMIN_EMAILS` + `PLATFORM_ADMIN_PASSWORD` ile platform yöneticisini
oluşturur. Alt süreç (CLI) gerektirmez; paylaşımlı hosting limitlerinden
etkilenmez.

**Yani:** DB boşsa https://wasys.pro/api/health adresini yenilemek yeterli —
tablolar ve admin otomatik oluşur (`database.selfHeal` alanında sonucu görürsünüz).

`db:bootstrap` mevcut müşteri verilerini silmez; yalnızca sunucu environment
variable’larında tanımlanan platform yöneticisini idempotent olarak hazırlar.
Kimlik bilgilerini kaynak koduna veya public dokümana yazmayın.

## `0.0.0.0:3000` yönlendirmesi

Hostinger uygulamayı `0.0.0.0` üzerinde dinletir. `.env` içinde **mutlaka**:

```env
AUTH_URL=https://wasys.pro
NEXTAUTH_URL=https://wasys.pro
```

Yoksa Auth.js seni `http://0.0.0.0:3000/login?error=Configuration` adresine atar.

`error=Configuration` = hâlâ `AUTH_SECRET` yok → yukarıdaki `.env` adımlarını tamamla + Restart.

## Login sayfasında ham kod (`$Sreact.fragment`) görünürse

Hostinger CDN eski `/login` RSC yanıtını HTML gibi tutuyor.

**Bu adresi kullan (düz HTML, RSC yok):**  
https://wasys.pro/giris

1. Redeploy
2. CDN Cache Purge
3. Gizli pencerede `/giris` aç
