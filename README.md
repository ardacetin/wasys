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

### Demo hesap

- `demo@wasys.app` / `demo1234`
- `agent@wasys.app` / `demo1234`

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

## Sonraki fazlar (Pro)

- Intent AI, Zoho/Shopify, çağrı merkezi
- Mobil uygulama (WapCRM)
- Instagram DM
