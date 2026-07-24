# WASYS

WhatsApp CRM — ortak gelen kutusu, QR ile WhatsApp bağlantısı (Baileys) ve Meta Cloud API desteği.

## Özellikler (Basic MVP)

- Ortak gelen kutusu, etiketleme, filtreleme
- Çok kullanıcılı sohbet / atama
- Hazır mesaj şablonları ve sohbet butonları
- Okundu / iletildi göstergeleri
- WhatsApp **QR** bağlantısı (öncelikli)
- WhatsApp **Cloud API** (ikincil)
- Basic / Pro paket kapıları
- Ekip yönetimi (Basic: 5 kullanıcı)
- Atama kuralları ve raporlama (Faz 2)
- Intent AI + Public API (Pro)

## Kurulum

```bash
npm install
cp .env.example .env
npm run db:push
npm run db:seed
```

İki süreç çalıştırın:

```bash
# terminal 1
npm run dev

# terminal 2
npm run dev:gateway
```

- Web: http://localhost:3000
- Gateway: http://localhost:4001

### Platform yöneticisi

Superadmin kimlik bilgileri repoda tutulmaz. Sunucuda `PLATFORM_ADMIN_EMAILS` ve
`PLATFORM_ADMIN_PASSWORD` environment variable’larıyla tanımlanır.

## Production env (wasys.pro)

Host panelinde **zorunlu**:

```bash
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="https://wasys.pro"
AUTH_TRUST_HOST="true"
DATABASE_URL="file:./data/prod.db"
```

Eksik `AUTH_SECRET` Auth.js’te şu hatayı üretir: *There is a problem with the server configuration.*

Sağlık kontrolü: `GET /api/health` (`AUTH_SECRET` / `DATABASE_URL` var mı — değerleri sızdırmaz).

## WhatsApp QR

1. Giriş yapın → **Kanallar**
2. **QR ile bağlan**
3. Telefonda WhatsApp → Bağlı Cihazlar → kodu tarayın
4. Bağlantı sonrası mesajlar gelen kutusuna düşer

Gateway `GATEWAY_SECRET` ile web uygulamasına webhook atar (`/api/webhooks/wa-gateway`).

## Cloud API

Kanallar sayfasından Phone Number ID + token kaydedin. Meta webhook URL:

`https://<host>/api/webhooks/meta`

Verify token: `.env` içindeki `META_VERIFY_TOKEN`.

## Mimari

```
Next.js (UI + API)  ←→  SQLite/Prisma
        ↑ webhook
Baileys Gateway (:4001)  ← QR / WhatsApp Web
```

## Sonraki fazlar

- Çağrı merkezi, Zoho/Shopify, Instagram DM, mobil uygulama

## Faz 2 (Pro çekirdek)

- Atama kuralları (keyword / kanal / atanmamış + round-robin)
- Intent AI (heuristic niyet analizi + önerilen yanıtlar, Pro)
- Public REST API (`/api/v1/...` + API anahtarları, Pro)
- Gerçek zamanlı raporlama paneli
