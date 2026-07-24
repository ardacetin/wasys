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

`.env` / panelde SQLite yolu **yazılabilir** absolute path olmalı:

```env
DATABASE_URL=file:/home/u781807728/domains/wasys.pro/nodejs/data/prod.db
```

**Error 14 / Unable to open the database file** = klasör yok veya yazma izni yok.
Hostinger Node çoğu zaman `domains/wasys.pro/data` (nodejs dışı) yoluna yazamaz.
Bu yüzden varsayılan yol `nodejs/data/prod.db`.

Kontrol listesi:
1. File Manager → `nodejs/data` klasörünü oluştur (boş olabilir)
2. `DATABASE_URL` yukarıdaki gibi olsun (panel **ve** `nodejs/.env`)
3. hPanel Node.js → **Application startup file / Entry file** = `server.js`
   (Hostinger’da `npm start` alanı olmayabilir — entry file kullan)
4. Build command varsa: `npm run build`
5. Redeploy / Restart
6. https://wasys.pro/api/health → `DATABASE_CONNECTED: true`

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
