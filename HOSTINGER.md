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
mkdir -p data
npx prisma db push
npm run db:seed
```

## Login sayfasında ham kod (`$Sreact.fragment`) görünürse

Bu, Hostinger CDN’nin RSC (React Flight) yanıtını HTML gibi cache’lemesi.

1. hPanel → **CDN / Cache** → **Purge / Clear Cache** (tüm site)
2. Node.js uygulamasını **Redeploy / Restart**
3. Tarayıcıda hard refresh: `Cmd+Shift+R` (veya gizli pencere)
4. Aç: `https://wasys.pro/login?nocache=1`

Hâlâ bozuksa File Manager’da `nodejs/.next` klasörünü silip yeniden deploy et.
