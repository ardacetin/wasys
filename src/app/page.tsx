import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="wasys-grid pointer-events-none absolute inset-0 opacity-60" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-brand-deep">
          WASYS
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/giris" className="rounded-full px-4 py-2 text-ink-muted hover:text-ink">
            Giriş
          </Link>
          <Link
            href="/kayit"
            className="rounded-full bg-brand px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-brand-deep"
          >
            Başla
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="animate-rise">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-brand">
            WhatsApp CRM
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl leading-[1.05] text-ink md:text-6xl lg:text-7xl">
            WASYS
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
            Ortak gelen kutusu, QR ile saniyeler içinde WhatsApp bağlantısı ve ekibinizin aynı
            sohbetleri yönetmesi — Basic paketten başlayın.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/kayit"
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-bg-elevated transition hover:bg-brand-deep"
            >
              Ücretsiz dene
            </Link>
            <Link
              href="/giris"
              className="rounded-full border border-line bg-bg-elevated/80 px-6 py-3 text-sm font-semibold backdrop-blur"
            >
              Demo giriş
            </Link>
          </div>
          <p className="mt-6 text-sm text-ink-muted">demo@wasys.app / demo1234</p>
        </div>

        <div className="animate-rise-delay relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand/20 via-transparent to-accent/20 blur-2xl" />
          <div className="relative overflow-hidden rounded-[1.5rem] border border-line bg-panel text-panel-ink shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-white/50">Gelen kutusu</div>
                <div className="font-[family-name:var(--font-display)] text-xl">Ortak sohbetler</div>
              </div>
              <span className="animate-pulse-soft rounded-full bg-brand/30 px-3 py-1 text-xs text-brand-soft">
                Canlı
              </span>
            </div>
            <div className="space-y-3 p-5">
              {[
                { name: "Ayşe Yılmaz", msg: "Siparişim ne zaman gelir?", tag: "Sipariş" },
                { name: "Mehmet Kaya", msg: "Fiyat listesi isterim", tag: "Yeni Lead" },
                { name: "Zeynep Demir", msg: "Uygulama açılmıyor", tag: "Destek" },
              ].map((item) => (
                <div
                  key={item.name}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{item.name}</div>
                    <span className="rounded-full bg-brand-soft/20 px-2 py-0.5 text-[11px] text-brand-soft">
                      {item.tag}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-white/65">{item.msg}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
