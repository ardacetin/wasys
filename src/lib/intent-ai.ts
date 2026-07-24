export type IntentResult = {
  intent: string;
  confidence: number;
  summary: string;
  suggestions: string[];
};

const RULES: { intent: string; keywords: string[]; suggestions: string[]; weight?: number }[] = [
  {
    intent: "siparis_sorgusu",
    keywords: ["sipariş", "siparis", "kargo", "teslimat", "ne zaman gelir", "takip"],
    suggestions: [
      "Sipariş numaranızı paylaşır mısınız?",
      "Siparişinizi kontrol ediyorum, kısa sürede döneceğim.",
    ],
  },
  {
    intent: "fiyat_talebi",
    keywords: ["fiyat", "ücret", "ucret", "liste", "kaç para", "kaç tl", "teklif"],
    suggestions: [
      "İlgilendiğiniz ürünü paylaşır mısınız?",
      "Güncel fiyat listesini hemen iletebilirim.",
    ],
  },
  {
    intent: "destek_teknik",
    keywords: ["açılmıyor", "acilmiyor", "hata", "çalışmıyor", "calismiyor", "bug", "uygulama"],
    suggestions: [
      "Hangi cihazda bu sorunu yaşıyorsunuz?",
      "Ekran görüntüsü paylaşabilir misiniz?",
    ],
  },
  {
    intent: "iade_iptal",
    keywords: ["iade", "iptal", "vazgeç", "vazgec", "geri ödeme", "geri odeme"],
    suggestions: [
      "İade talebinizi not aldım. Sipariş numaranızı yazar mısınız?",
      "İptal işlemi için hesabınızı kontrol ediyorum.",
    ],
  },
  {
    intent: "selamlama",
    keywords: ["merhaba", "selam", "iyi günler", "günaydın", "gunaydin"],
    suggestions: ["Merhaba! Size nasıl yardımcı olabilirim?"],
    weight: 0.4,
  },
];

export function analyzeIntent(messages: { direction: string; body: string | null }[]): IntentResult {
  const inbound = messages
    .filter((m) => m.direction === "INBOUND" && m.body)
    .slice(-8)
    .map((m) => m.body!.toLowerCase())
    .join(" \n ");

  if (!inbound.trim()) {
    return {
      intent: "belirsiz",
      confidence: 0.2,
      summary: "Yeterli müşteri mesajı yok.",
      suggestions: ["Merhaba! Size nasıl yardımcı olabilirim?"],
    };
  }

  let best = { intent: "genel_bilgi", score: 0, suggestions: ["Size nasıl yardımcı olabilirim?"] as string[] };

  for (const rule of RULES) {
    let hits = 0;
    for (const kw of rule.keywords) {
      if (inbound.includes(kw)) hits += 1;
    }
    if (!hits) continue;
    const score = hits * (rule.weight ?? 1);
    if (score > best.score) {
      best = { intent: rule.intent, score, suggestions: rule.suggestions };
    }
  }

  const confidence = Math.min(0.95, 0.35 + best.score * 0.2);
  const labels: Record<string, string> = {
    siparis_sorgusu: "Sipariş / teslimat sorusu",
    fiyat_talebi: "Fiyat / teklif talebi",
    destek_teknik: "Teknik destek ihtiyacı",
    iade_iptal: "İade / iptal talebi",
    selamlama: "Selamlama",
    genel_bilgi: "Genel bilgi",
    belirsiz: "Belirsiz",
  };

  return {
    intent: best.intent,
    confidence,
    summary: labels[best.intent] ?? best.intent,
    suggestions: best.suggestions,
  };
}
