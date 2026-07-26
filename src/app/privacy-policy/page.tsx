import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Gizlilik Politikası",
  description: "WASYS gizlilik politikası ve kişisel verilerin işlenmesi hakkında bilgi.",
  alternates: { canonical: "https://wasys.pro/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Gizlilik Politikası"
      description="Son güncelleme: 26 Temmuz 2026 · Geçerli alan: wasys.pro"
    >
      <LegalSection title="1. Giriş">
        <p>
          WASYS (“biz”, “platform”), WhatsApp üzerinden müşteri iletişimi ve CRM
          hizmeti sunan bir yazılımdır. Bu politika,{" "}
          <strong>https://wasys.pro</strong> üzerinden toplanan ve işlenen
          verileri açıklar.
        </p>
      </LegalSection>

      <LegalSection title="2. Topladığımız veriler">
        <ul>
          <li>
            <strong>Hesap bilgileri:</strong> ad, e-posta, şifre (hash’lenmiş),
            organizasyon / şirket adı, rol.
          </li>
          <li>
            <strong>İletişim verileri:</strong> WhatsApp numaraları, kişi adları,
            mesaj içerikleri, medya bağlantıları, etiketler ve CRM notları.
          </li>
          <li>
            <strong>Bağlantı verileri:</strong> WhatsApp QR oturum bilgileri
            (cihaz kimlikleri), Meta / WhatsApp Cloud API token’ları ve kanal
            kimlikleri.
          </li>
          <li>
            <strong>Teknik veriler:</strong> oturum çerezleri, IP / tarayıcı
            bilgisi (güvenlik ve günlükler), kullanım metrikleri.
          </li>
          <li>
            <strong>Facebook / Meta üzerinden:</strong> WhatsApp Cloud bağlantısı
            sırasında Meta’nın verdiği iş hesabı (WABA), telefon numarası kimliği
            ve erişim token’ı — yalnızca Cloud API’yi sizin adınıza çalıştırmak
            için.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Verileri nasıl kullanıyoruz">
        <ul>
          <li>Hizmeti sağlamak (gelen kutusu, CRM, otomasyon, raporlar)</li>
          <li>WhatsApp mesajlarını iletmek ve almak</li>
          <li>Hesap güvenliği, destek ve faturalandırma</li>
          <li>Yasal yükümlülükleri yerine getirmek</li>
        </ul>
        <p>Verilerinizi reklam amacıyla üçüncü taraflara satmayız.</p>
      </LegalSection>

      <LegalSection title="4. Paylaşım">
        <p>Veriler yalnızca şu durumlarda paylaşılabilir:</p>
        <ul>
          <li>
            <strong>Meta / WhatsApp:</strong> mesajlaşma ve Cloud API için
          </li>
          <li>
            <strong>Altyapı sağlayıcıları:</strong> barındırma, e-posta gönderimi
            (ör. Hostinger SMTP)
          </li>
          <li>
            <strong>Yasal zorunluluk:</strong> yetkili mercilerin talebi
          </li>
        </ul>
        Her müşteri (kiracı) verisi diğer kiracılardan ayrı tutulur.
      </LegalSection>

      <LegalSection title="5. Saklama ve güvenlik">
        <p>
          Veriler, hizmet süresince ve yasal saklama süreleri boyunca tutulur.
          Şifreler hash’lenir; erişim rol bazlıdır. Yine de internet üzerinden
          %100 güvenlik garanti edilemez.
        </p>
      </LegalSection>

      <LegalSection title="6. Haklarınız">
        <p>
          KVKK kapsamında verilerinize erişme, düzeltme, silme ve işlemeyi
          kısıtlama talebinde bulunabilirsiniz. Silme talepleri için{" "}
          <a href="/user-data" className="font-semibold text-brand hover:underline">
            Kullanıcı Verisi Silme
          </a>{" "}
          sayfasını kullanın veya{" "}
          <a
            href="mailto:destek@wasys.pro"
            className="font-semibold text-brand hover:underline"
          >
            destek@wasys.pro
          </a>{" "}
          adresine yazın.
        </p>
      </LegalSection>

      <LegalSection title="7. Çerezler">
        <p>
          Oturum açma ve güvenlik için gerekli çerezler kullanılır. Zorunlu
          çerezler olmadan platform çalışmaz.
        </p>
      </LegalSection>

      <LegalSection title="8. İletişim">
        <p>
          WASYS · <a href="https://wasys.pro">wasys.pro</a>
          <br />
          E-posta:{" "}
          <a href="mailto:destek@wasys.pro" className="text-brand hover:underline">
            destek@wasys.pro
          </a>
        </p>
      </LegalSection>
    </LegalPage>
  );
}
