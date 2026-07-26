import Link from "next/link";
import { MessageCircleMore } from "lucide-react";

export function LegalPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-bg text-ink">
      <header className="border-b border-line bg-bg-elevated/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-[family-name:var(--font-display)] text-xl text-brand-deep"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white">
              <MessageCircleMore size={18} aria-hidden />
            </span>
            WASYS
          </Link>
          <nav className="flex flex-wrap gap-3 text-xs font-semibold text-ink-muted sm:text-sm">
            <Link href="/privacy-policy" className="hover:text-brand-deep">
              Gizlilik
            </Link>
            <Link href="/terms" className="hover:text-brand-deep">
              Şartlar
            </Link>
            <Link href="/user-data" className="hover:text-brand-deep">
              Veri silme
            </Link>
            <Link href="/giris" className="text-brand hover:text-brand-deep">
              Giriş
            </Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-4xl tracking-tight text-brand-deep">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 text-sm text-ink-muted">{description}</p>
        ) : null}
        <div className="legal-prose mt-10 space-y-6 text-sm leading-7 text-ink">
          {children}
        </div>
      </article>

      <footer className="border-t border-line py-8 text-center text-xs text-ink-muted">
        <p>© {new Date().getFullYear()} WASYS · wasys.pro</p>
        <p className="mt-2">
          <a href="mailto:destek@wasys.pro" className="text-brand hover:underline">
            destek@wasys.pro
          </a>
        </p>
      </footer>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-brand-deep">{title}</h2>
      <div className="mt-2 space-y-3 text-ink-muted [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
