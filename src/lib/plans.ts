/**
 * WASYS tek paket. Fiyatlandırma boyutu: kullanıcı (koltuk) sayısı.
 * Basic/Pro ayrımı yok.
 */

export const PACKAGE_NAME = "WASYS";

/** Liste / referans fiyat (kullanıcı başı aylık, USD). */
export const LIST_PRICE_PER_USER_USD = 30;
/** Kurulum sonrası kullanıcı başı aylık (USD). */
export const MONTHLY_PRICE_PER_USER_USD = 20;
/** Tek seferlik kurulum ücreti (USD). */
export const SETUP_FEE_USD = 50;

/** Pakete dahil özellikler (pazarlama + paket sayfası). */
export const PACKAGE_FEATURES = [
  "Ortak gelen kutusu",
  "Sınırsız mesaj ve kişi",
  "Etiketleme ve filtreleme",
  "Hazır mesaj şablonları",
  "Sesli mesajlar",
  "Çoklu kullanıcı sohbeti",
  "Otomatik atama kuralları",
  "Otomasyon (karşılama / meşgul / dağıtım)",
  "CRM ve raporlama",
] as const;

/**
 * Kullanıcı sayısına göre gösterim dilimleri (eski UI / iç etiketler).
 */
export const SEAT_TIERS = [
  {
    id: "starter",
    label: "1–5 kullanıcı",
    seatsHint: "Küçük ekipler",
    minUsers: 1,
    maxUsers: 5,
    priceHint: `$${MONTHLY_PRICE_PER_USER_USD}/kullanıcı/ay`,
  },
  {
    id: "growth",
    label: "6–15 kullanıcı",
    seatsHint: "Büyüyen ekipler",
    minUsers: 6,
    maxUsers: 15,
    priceHint: `$${MONTHLY_PRICE_PER_USER_USD}/kullanıcı/ay`,
    featured: true,
  },
  {
    id: "scale",
    label: "16+ kullanıcı",
    seatsHint: "Ölçeklenen operasyonlar",
    minUsers: 16,
    maxUsers: null as number | null,
    priceHint: `$${MONTHLY_PRICE_PER_USER_USD}/kullanıcı/ay`,
  },
] as const;

export function packageLabel(_plan?: string | null) {
  return PACKAGE_NAME;
}

export function seatTierForUsers(userCount: number) {
  const n = Math.max(1, userCount);
  return (
    SEAT_TIERS.find((t) => n >= t.minUsers && (t.maxUsers == null || n <= t.maxUsers)) ??
    SEAT_TIERS[SEAT_TIERS.length - 1]
  );
}
