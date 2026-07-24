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

`.env` içindeki SQLite yolu `DATABASE_URL=file:./prod.db` olmalı. Prisma göreli
yolu `prisma/schema.prisma` konumuna göre çözer; dosya `prisma/prod.db` olarak oluşur.
`file:./data/prod.db` kullanılırsa `prisma/data` bulunmadığında DB bağlantısı başarısız olur.

`db:bootstrap` mevcut müşteri verilerini silmez; demo organizasyonu ve
`demo@wasys.app / demo1234` hesabını idempotent olarak hazırlar.

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
