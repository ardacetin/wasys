import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Kullanım Şartları",
  description: "WASYS hizmet kullanım şartları (Terms of Service).",
  alternates: { canonical: "https://wasys.pro/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Kullanım Şartları"
      description="Son güncelleme: 26 Temmuz 2026 · https://wasys.pro/terms"
    >
      <LegalSection title="1. Taraflar">
        <p>
          Bu şartlar, WASYS platformunu (“Hizmet”) kullanan müşteri / kullanıcı
          ile WASYS arasında geçerlidir. Hizmete kayıt olan veya giriş yapan
          kişi bu şartları kabul etmiş sayılır.
        </p>
      </LegalSection>

      <LegalSection title="2. Hizmetin kapsamı">
        <p>
          WASYS; WhatsApp mesajlaşmasının ortak gelen kutusu, ekip yönetimi,
          CRM, otomasyon, raporlama ve ilgili entegrasyonları (QR / Cloud API)
          sunar. Özellikler paket ve kota limitlerine bağlıdır.
        </p>
      </LegalSection>

      <LegalSection title="3. Hesap ve sorumluluklar">
        <ul>
          <li>
            Hesap bilgilerinizin doğruluğundan ve şifrenizin gizliliğinden siz
            sorumlusunuz.
          </li>
          <li>
            WhatsApp / Meta kurallarına, KVKK’ya ve geçerli mevzuata uymak
            zorundasınız.
          </li>
          <li>
            Spam, izinsiz toplu mesaj, yasa dışı içerik veya üçüncü kişi
            haklarını ihlal eden kullanım yasaktır.
          </li>
          <li>
            Kiracı (organizasyon) verilerinden ve ekip üyelerinin
            eylemlerinden hesap sahibi sorumludur.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. WhatsApp ve Meta">
        <p>
          WhatsApp QR (Baileys tabanlı bağlı cihaz) ve WhatsApp Cloud API, Meta
          / WhatsApp politikalarına tabidir. Meta’nın hizmet kesintisi, numara
          kısıtlaması veya API değişikliklerinden WASYS sorumlu tutulamaz.
          Cloud bağlantısı için Facebook yetkilendirmesi sizin kontrolünüzdedir.
        </p>
      </LegalSection>

      <LegalSection title="5. Ücretlendirme">
        <p>
          Ücretler kullanıcı (koltuk) kotasına ve üzerinde anlaşılan pakete göre
          belirlenir. Ödeme yapılmaması durumunda hesap askıya alınabilir.
          İade politikası sözleşme / teklif metninde belirtilir.
        </p>
      </LegalSection>

      <LegalSection title="6. Fikri mülkiyet">
        <p>
          WASYS yazılımı, markası ve içeriği WASYS’e aittir. Size yalnızca
          abonelik süresince sınırlı, devredilemez bir kullanım hakkı verilir.
        </p>
      </LegalSection>

      <LegalSection title="7. Gizlilik">
        <p>
          Kişisel verilerin işlenmesi{" "}
          <a
            href="/privacy-policy"
            className="font-semibold text-brand hover:underline"
          >
            Gizlilik Politikası
          </a>{" "}
          kapsamında yürütülür. Veri silme talepleri için{" "}
          <a href="/user-data" className="font-semibold text-brand hover:underline">
            /user-data
          </a>{" "}
          sayfasına bakın.
        </p>
      </LegalSection>

      <LegalSection title="8. Sorumluluk sınırı">
        <p>
          Hizmet “olduğu gibi” sunulur. Dolaylı zararlar, kâr kaybı, veri kaybı
          veya iş kesintisinden doğan zararlardan, yürürlükteki hukukun izin
          verdiği ölçüde sorumlu değiliz. Zorunlu hallerde toplam sorumluluk,
          son 3 ayda ödediğiniz ücretlerle sınırlıdır.
        </p>
      </LegalSection>

      <LegalSection title="9. Askıya alma ve fesih">
        <p>
          Şartların ihlali, kötüye kullanım veya yasal risk halinde hesabı
          askıya alabilir veya sonlandırabiliriz. Siz de istediğiniz zaman
          aboneliği sonlandırıp veri silme talebinde bulunabilirsiniz.
        </p>
      </LegalSection>

      <LegalSection title="10. Değişiklikler">
        <p>
          Bu şartları güncelleyebiliriz. Önemli değişiklikler wasys.pro
          üzerinden veya e-posta ile duyurulur. Güncellemeden sonra Hizmeti
          kullanmaya devam etmeniz kabul anlamına gelir.
        </p>
      </LegalSection>

      <LegalSection title="11. İletişim">
        <p>
          WASYS
          <br />
          <a href="mailto:destek@wasys.pro" className="text-brand hover:underline">
            destek@wasys.pro
          </a>
          <br />
          <a href="https://wasys.pro" className="text-brand hover:underline">
            https://wasys.pro
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
