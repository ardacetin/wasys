import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  CheckCheck,
  Clock3,
  Headphones,
  Inbox,
  MessageCircleMore,
  QrCode,
  ShieldCheck,
  Sparkles,
  Tags,
  Users,
  Workflow,
} from "lucide-react";
import { QuoteForm } from "@/components/marketing/quote-form";

const features = [
  {
    icon: Inbox,
    title: "Tek gelen kutusu",
    description: "WhatsApp konuşmalarını ekibinizle tek ekrandan yönetin.",
  },
  {
    icon: Users,
    title: "Akıllı ekip yönetimi",
    description: "Sohbetleri atayın, iş yükünü dengeleyin ve sahipliği netleştirin.",
  },
  {
    icon: Tags,
    title: "Etiket ve filtreler",
    description: "Satış, destek ve sipariş konuşmalarını saniyeler içinde bulun.",
  },
  {
    icon: Bot,
    title: "Intent AI",
    description: "Müşteri niyetini analiz edin, temsilcinize yanıt önerileri sunun.",
  },
  {
    icon: BarChart3,
    title: "Canlı raporlama",
    description: "Mesaj hacmi, ekip yükü ve performansı gerçek zamanlı izleyin.",
  },
  {
    icon: ShieldCheck,
    title: "Güvenli erişim",
    description: "Kapalı kayıt, rol bazlı yetki ve organizasyon izolasyonuyla çalışın.",
  },
];

const basicFeatures = [
  "5 kullanıcıya kadar",
  "Sınırsız mesaj ve kişi",
  "Ortak gelen kutusu",
  "Etiketler ve gelişmiş filtreler",
  "Hazır mesaj şablonları",
  "Sesli mesaj desteği",
];

const proFeatures = [
  "Basic paketteki her şey",
  "Intent AI önerileri",
  "Otomatik atama kuralları",
  "API anahtarları",
  "Gelişmiş raporlama",
  "Zoho, Shopify ve çağrı merkezi altyapısı",
];

export default function HomePage() {
  return (
    <main className="overflow-hidden bg-bg text-ink">
      <header className="sticky top-0 z-50 border-b border-brand-deep/10 bg-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-18 w-full max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-2xl tracking-tight text-brand-deep"
            aria-label="WASYS ana sayfa"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white">
              <MessageCircleMore size={20} aria-hidden="true" />
            </span>
            WASYS
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-semibold text-ink-muted md:flex" aria-label="Ana menü">
            <a href="#ozellikler" className="transition hover:text-brand-deep">
              Özellikler
            </a>
            <a href="#nasil-calisir" className="transition hover:text-brand-deep">
              Nasıl çalışır?
            </a>
            <a href="#planlar" className="transition hover:text-brand-deep">
              Planlar
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/giris"
              className="inline-flex min-h-11 items-center rounded-full border border-brand/25 bg-white px-4 text-sm font-bold text-brand-deep transition hover:border-brand hover:bg-brand-soft/50"
            >
              Giriş yap
            </Link>
            <a
              href="#teklif"
              className="hidden min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold text-white shadow-[0_10px_30px_rgba(18,140,126,0.2)] transition hover:bg-brand-deep sm:inline-flex"
            >
              Teklif al
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="wasys-grid pointer-events-none absolute inset-0 opacity-55" />
        <div className="pointer-events-none absolute -right-48 top-10 h-[32rem] w-[32rem] rounded-full bg-accent/15 blur-3xl" />
        <div className="relative mx-auto grid min-h-[44rem] w-full max-w-7xl items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
          <div className="animate-rise">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-white/80 px-3 py-1.5 text-xs font-bold text-brand-deep shadow-sm">
              <Sparkles size={14} className="text-brand" aria-hidden="true" />
              WhatsApp satış ve destek operasyonunuz tek yerde
            </div>
            <h1 className="mt-6 max-w-3xl font-[family-name:var(--font-display)] text-5xl leading-[1.02] tracking-[-0.04em] text-ink sm:text-6xl lg:text-[4.6rem]">
              Mesajları değil,
              <span className="block text-brand-deep">müşteri ilişkilerini yönetin.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted">
              WASYS; WhatsApp görüşmelerini ortak gelen kutusunda toplar, ekibinizin daha hızlı
              yanıt vermesini ve hiçbir fırsatın gözden kaçmamasını sağlar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#teklif"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white shadow-[0_14px_35px_rgba(18,140,126,0.25)] transition hover:-translate-y-0.5 hover:bg-brand-deep"
              >
                Ekibime özel teklif al
                <ArrowRight size={17} aria-hidden="true" />
              </a>
              <Link
                href="/giris"
                className="inline-flex min-h-12 items-center rounded-full border border-line bg-white px-6 text-sm font-bold text-ink transition hover:border-brand"
              >
                Demo hesabına gir
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink-muted">
              {["Kurulum desteği", "Kapalı ve güvenli kayıt", "İhtiyaca özel fiyat"].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
                    <Check size={13} strokeWidth={3} aria-hidden="true" />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="animate-rise-delay relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-5 rounded-[2.25rem] bg-gradient-to-br from-brand/20 to-accent/15 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-brand-deep/15 bg-panel text-panel-ink shadow-[0_30px_100px_rgba(7,94,84,0.2)]">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-brand-deep">
                    <Inbox size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold">Ortak gelen kutusu</p>
                    <p className="text-xs text-white/50">Satış & Destek</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-bold text-brand-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                  Canlı
                </span>
              </div>
              <div className="grid min-h-[28rem] grid-cols-[5rem_1fr]">
                <div className="border-r border-white/10 p-3">
                  <div className="space-y-3">
                    {["AY", "MK", "ZD", "EA"].map((initials, index) => (
                      <div
                        key={initials}
                        className={`relative flex h-11 w-11 items-center justify-center rounded-full text-xs font-bold ${
                          index === 0 ? "bg-accent text-brand-deep" : "bg-white/8 text-white/60"
                        }`}
                      >
                        {initials}
                        {index < 2 ? (
                          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-panel bg-accent" />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="border-b border-white/10 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold">Ayşe Yılmaz</p>
                        <p className="text-[11px] text-white/50">+90 532 ••• •• 33</p>
                      </div>
                      <span className="rounded-full bg-accent/15 px-2 py-1 text-[10px] font-bold text-brand-soft">
                        Sipariş
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3 p-4">
                    <div className="max-w-[82%] rounded-2xl rounded-tl-md bg-white/9 px-3.5 py-2.5 text-sm text-white/80">
                      Merhaba, siparişim ne zaman kargoya verilir?
                      <p className="mt-1 text-right text-[10px] text-white/35">13:42</p>
                    </div>
                    <div className="ml-auto max-w-[82%] rounded-2xl rounded-tr-md bg-brand px-3.5 py-2.5 text-sm text-white">
                      Siparişinizi kontrol ediyorum. Kısa süre içinde bilgi vereceğim.
                      <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/70">
                        13:43 <CheckCheck size={13} className="text-brand-soft" />
                      </p>
                    </div>
                    <div className="rounded-xl border border-accent/20 bg-accent/8 p-3">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold text-brand-soft">
                        <Bot size={13} aria-hidden="true" /> Intent AI
                      </p>
                      <p className="mt-1 text-xs text-white/60">
                        Niyet: Sipariş durumu · Güven %94
                      </p>
                    </div>
                  </div>
                  <div className="m-4 flex min-h-11 items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 text-xs text-white/40">
                    Mesajınızı yazın...
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
                      <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-5 -left-5 hidden items-center gap-3 rounded-2xl border border-brand/15 bg-white p-3 shadow-xl sm:flex">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand-deep">
                <Clock3 size={19} />
              </span>
              <div>
                <p className="text-xs text-ink-muted">Ortalama yanıt</p>
                <p className="text-sm font-extrabold text-ink">1 dk 24 sn</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-brand-deep/10 bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-5 py-8 sm:grid-cols-4 lg:px-8">
          {[
            ["Sınırsız", "mesaj ve kişi"],
            ["Tek ekran", "tüm ekip"],
            ["Gerçek zamanlı", "raporlama"],
            ["QR veya Cloud API", "esnek bağlantı"],
          ].map(([value, label]) => (
            <div key={label} className="px-3 py-3 text-center">
              <p className="font-[family-name:var(--font-display)] text-xl text-brand-deep">{value}</p>
              <p className="mt-1 text-xs text-ink-muted">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="ozellikler" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Tek platform</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
            WhatsApp operasyonunuz için gereken her şey
          </h2>
          <p className="mt-4 text-base leading-7 text-ink-muted">
            Dağınık telefonlar ve cevapsız mesajlar yerine; ölçülebilir, atanabilir ve ölçeklenebilir
            bir müşteri iletişim süreci.
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="group rounded-2xl border border-brand-deep/10 bg-white p-6 transition hover:-translate-y-1 hover:border-brand/35 hover:shadow-[0_20px_50px_rgba(7,94,84,0.08)]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand-deep transition group-hover:bg-brand group-hover:text-white">
                <Icon size={21} aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-extrabold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-muted">{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="nasil-calisir" className="scroll-mt-24 bg-panel py-20 text-panel-ink lg:py-28">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                Hızlı başlangıç
              </p>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-tight sm:text-5xl">
                Bugün bağlanın, ekibiniz yarın hızlansın.
              </h2>
              <p className="mt-5 text-base leading-7 text-white/60">
                Teknik karmaşa olmadan bağlantıyı kurun; konuşmaları, ekibi ve raporları tek merkezden
                yönetin.
              </p>
            </div>
            <ol className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  icon: QrCode,
                  number: "01",
                  title: "WhatsApp’ı bağlayın",
                  text: "QR kod veya resmi Cloud API ile kanalınızı ekleyin.",
                },
                {
                  icon: Workflow,
                  number: "02",
                  title: "Ekibinizi kurun",
                  text: "Temsilcileri ekleyin, etiketleri ve atama kurallarını tanımlayın.",
                },
                {
                  icon: Headphones,
                  number: "03",
                  title: "Birlikte yönetin",
                  text: "Mesajları yanıtlayın, performansı izleyin ve süreçleri geliştirin.",
                },
              ].map(({ icon: Icon, number, title, text }) => (
                <li key={number} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-brand-deep">
                      <Icon size={20} />
                    </span>
                    <span className="text-xs font-bold text-white/30">{number}</span>
                  </div>
                  <h3 className="mt-6 font-bold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/55">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="planlar" className="scroll-mt-24 py-20 lg:py-28">
        <div className="mx-auto max-w-6xl px-5 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Esnek planlar</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">
              Ekibiniz kadar esnek fiyatlandırma
            </h2>
            <p className="mt-4 text-base leading-7 text-ink-muted">
              Sabit bir kalıba sığmayın. Kullanıcı sayınız ve ihtiyaçlarınıza göre size özel teklif
              hazırlayalım.
            </p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {[
              {
                name: "Basic",
                description: "WhatsApp iletişimini tek merkezde toplamak isteyen ekipler için.",
                features: basicFeatures,
                featured: false,
              },
              {
                name: "Pro",
                description: "Otomasyon, yapay zekâ ve entegrasyonla ölçeklenen ekipler için.",
                features: proFeatures,
                featured: true,
              },
            ].map((plan) => (
              <article
                key={plan.name}
                className={`relative rounded-[1.75rem] border p-7 sm:p-8 ${
                  plan.featured
                    ? "border-brand bg-brand-deep text-white shadow-[0_24px_70px_rgba(7,94,84,0.2)]"
                    : "border-brand-deep/10 bg-white"
                }`}
              >
                {plan.featured ? (
                  <span className="absolute right-6 top-6 rounded-full bg-accent px-3 py-1 text-[11px] font-extrabold text-brand-deep">
                    EN ÇOK TERCİH EDİLEN
                  </span>
                ) : null}
                <p className={`text-sm font-bold ${plan.featured ? "text-brand-soft" : "text-brand"}`}>
                  {plan.name}
                </p>
                <h3 className="mt-3 font-[family-name:var(--font-display)] text-3xl">Teklif al</h3>
                <p className={`mt-3 max-w-md text-sm leading-6 ${plan.featured ? "text-white/65" : "text-ink-muted"}`}>
                  {plan.description}
                </p>
                <ul className="mt-7 grid gap-3 sm:grid-cols-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm">
                      <span
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          plan.featured ? "bg-accent text-brand-deep" : "bg-brand-soft text-brand-deep"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href="#teklif"
                  className={`mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition ${
                    plan.featured
                      ? "bg-accent text-brand-deep hover:bg-brand-soft"
                      : "bg-brand text-white hover:bg-brand-deep"
                  }`}
                >
                  {plan.name} için teklif iste
                  <ArrowRight size={16} />
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="teklif" className="relative scroll-mt-20 border-t border-brand-deep/10 bg-brand-soft/35 py-20 lg:py-28">
        <div className="pointer-events-none absolute inset-0 wasys-grid opacity-30" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div>
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
              <MessageCircleMore size={24} />
            </span>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-brand">Size özel</p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-tight sm:text-5xl">
              WhatsApp operasyonunuzu birlikte planlayalım.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink-muted">
              Ekibinizin büyüklüğünü ve hedeflerinizi paylaşın. Doğru paket, kurulum kapsamı ve
              fiyatlandırmayla size dönüş yapalım.
            </p>
            <div className="mt-8 space-y-4">
              {[
                "İhtiyacınıza göre kullanıcı ve kanal planlaması",
                "QR veya Cloud API için kurulum danışmanlığı",
                "Zorunlu taahhüt olmadan ön görüşme",
              ].map((item) => (
                <p key={item} className="flex items-start gap-3 text-sm font-semibold">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                    <Check size={14} strokeWidth={3} />
                  </span>
                  {item}
                </p>
              ))}
            </div>
          </div>
          <QuoteForm />
        </div>
      </section>

      <footer className="bg-panel text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div>
            <div className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-2xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-brand-deep">
                <MessageCircleMore size={20} />
              </span>
              WASYS
            </div>
            <p className="mt-2 text-xs text-white/45">WhatsApp CRM · Satış ve destek tek merkezde</p>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-sm text-white/60">
            <a href="#ozellikler" className="hover:text-white">Özellikler</a>
            <a href="#planlar" className="hover:text-white">Planlar</a>
            <a href="#teklif" className="hover:text-white">Teklif al</a>
            <Link href="/giris" className="font-bold text-brand-soft hover:text-white">Giriş yap</Link>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-white/35">
          © {new Date().getFullYear()} WASYS. Tüm hakları saklıdır.
        </div>
      </footer>
    </main>
  );
}
