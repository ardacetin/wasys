import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Kullanıcı Verisi Silme",
  description:
    "WASYS hesap ve kullanıcı verilerinin silinmesi talebi — Meta / Facebook uygulama gereksinimleri.",
  alternates: { canonical: "https://wasys.pro/user-data" },
};

export default function UserDataDeletionPage() {
  return (
    <LegalPage
      title="Kullanıcı Verisi Silme"
      description="Son güncelleme: 26 Temmuz 2026 · Meta Data Deletion / kullanıcı talep sayfası"
    >
      <LegalSection title="1. Amaç">
        <p>
          Bu sayfa, WASYS veya Facebook / Meta üzerinden WASYS’e bağlanan
          kullanıcıların verilerinin nasıl silineceğini açıklar. Facebook
          uygulaması incelemesi için veri silme talimatları burada yayınlanır.
        </p>
      </LegalSection>

      <LegalSection title="2. Neler silinir">
        <p>Talebiniz onaylandığında, organizasyonunuzla ilişkili olarak:</p>
        <ul>
          <li>Kullanıcı hesapları (ad, e-posta, roller)</li>
          <li>WhatsApp sohbetleri, mesajlar ve medya referansları</li>
          <li>CRM kişileri, notlar, etiketler ve şablonlar</li>
          <li>Kanal oturumları ve saklanan Cloud API token’ları</li>
          <li>Otomasyon / atama kuralları ve rapor verileri</li>
        </ul>
        <p>
          Yasal saklama zorunluluğu olan fatura / log kayıtları, zorunlu süre
          boyunca anonimleştirilmiş veya kısıtlı tutulabilir.
        </p>
      </LegalSection>

      <LegalSection title="3. Nasıl talep edilir">
        <p>
          <strong>Yöntem A — E-posta (önerilen):</strong>
        </p>
        <ul>
          <li>
            <a
              href="mailto:destek@wasys.pro?subject=Veri%20silme%20talebi&body=Ad%20Soyad%3A%0AE-posta%3A%0AOrganizasyon%20%2F%20firma%3A%0ASilinmesini%20istedi%C4%9Finiz%20hesap%20e-postas%C4%B1%3A%0AEk%20not%3A"
              className="font-semibold text-brand hover:underline"
            >
              destek@wasys.pro
            </a>{" "}
            adresine “Veri silme talebi” konulu mail gönderin.
          </li>
          <li>
            Mailde: adınız, hesabınızın e-postası, organizasyon / firma adı ve
            mümkünse Facebook / Meta kullanıcı kimliğiniz yer alsın.
          </li>
        </ul>
        <p className="mt-3">
          <strong>Yöntem B — Uygulama içi:</strong> Giriş yaptıktan sonra hesap
          sahibi (OWNER), destek ile iletişime geçerek organizasyonun tamamen
          kapatılmasını ve verilerin silinmesini isteyebilir.
        </p>
      </LegalSection>

      <LegalSection title="4. Süreç ve süre">
        <ul>
          <li>Talebi 2 iş günü içinde onaylarız veya ek bilgi isteriz.</li>
          <li>
            Kimlik doğrulaması sonrası silme işlemi genellikle{" "}
            <strong>30 gün</strong> içinde tamamlanır.
          </li>
          <li>
            Tamamlandığında talep sahibine e-posta ile bilgi verilir.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Facebook / Meta üzerinden gelen talepler">
        <p>
          Meta, uygulama ayarlarından “Data Deletion Request Callback” veya bu
          URL’yi kullanabilir:{" "}
          <strong>https://wasys.pro/user-data</strong>. Kullanıcı Facebook
          hesabı üzerinden WASYS izinlerini kaldırdıysa, yukarıdaki e-posta
          yöntemiyle de silme talep edebilir.
        </p>
      </LegalSection>

      <LegalSection title="6. İletişim">
        <p>
          WASYS Veri Koruma
          <br />
          <a href="mailto:destek@wasys.pro" className="text-brand hover:underline">
            destek@wasys.pro
          </a>
          <br />
          Web:{" "}
          <a href="https://wasys.pro" className="text-brand hover:underline">
            https://wasys.pro
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
