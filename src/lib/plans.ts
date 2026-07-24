/**
 * WASYS tek paket. Fiyatlandırma boyutu: kullanıcı (koltuk) sayısı.
 * Basic/Pro ayrımı yok.
 */

export const PACKAGE_NAME = "WASYS";

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
 * Kullanıcı sayısına göre gösterim / teklif dilimleri.
 * Gerçek fiyat teklifle belirlenir; burada yalnızca ölçek vurgulanır.
 */
export const SEAT_TIERS = [
  {
    id: "starter",
    label: "1–5 kullanıcı",
    seatsHint: "Küçük ekipler",
    minUsers: 1,
    maxUsers: 5,
    priceHint: "Teklif alın",
  },
  {
    id: "growth",
    label: "6–15 kullanıcı",
    seatsHint: "Büyüyen ekipler",
    minUsers: 6,
    maxUsers: 15,
    priceHint: "Teklif alın",
    featured: true,
  },
  {
    id: "scale",
    label: "16+ kullanıcı",
    seatsHint: "Ölçeklenen operasyonlar",
    minUsers: 16,
    maxUsers: null as number | null,
    priceHint: "Teklif alın",
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
