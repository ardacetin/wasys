import { requireSession } from "@/lib/session";
import { PACKAGE_FEATURES, PACKAGE_NAME } from "@/lib/plans";
import { prisma } from "@/lib/db";

export default async function PlanPage() {
  const session = await requireSession();
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.user.organizationId },
    include: { _count: { select: { users: true } } },
  });
  const usagePercent = Math.min(
    100,
    Math.round((org._count.users / Math.max(org.maxUsers, 1)) * 100),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Paket</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {org.name} — tek WASYS paketi; ücretlendirme kullanıcı sayınıza göre
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-brand bg-brand-soft/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Aktif paket</p>
          <div className="mt-1 font-[family-name:var(--font-display)] text-3xl">
            {PACKAGE_NAME}
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Tüm özellikler dahil. Fiyat farkı yalnızca kullanıcı kotasından gelir.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-bg-elevated p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Kullanıcı kotası
          </p>
          <div className="mt-1 font-[family-name:var(--font-display)] text-3xl">
            {org._count.users}
            <span className="text-lg text-ink-muted"> / {org.maxUsers}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
            <div
              className={`h-full rounded-full ${usagePercent >= 100 ? "bg-danger" : "bg-brand"}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {usagePercent >= 100
              ? "Kota doldu. Artırmak için WASYS yöneticisiyle iletişime geçin."
              : `${org.maxUsers - org._count.users} kullanıcı hakkınız kaldı.`}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">Pakete dahil özellikler</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PACKAGE_FEATURES.map((label) => (
            <div key={label} className="text-ok">
              ✓ {label}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-bg-elevated p-5 text-sm">
        <h2 className="font-semibold">Kullanıcı kotası artırmak istiyor musunuz?</h2>
        <p className="mt-2 text-ink-muted">
          Kota artırımı WASYS sistem yöneticisi tarafından yapılır. İhtiyacınızı
          paylaşın, size özel fiyatlandırmayla dönüş yapılsın.
        </p>
        <a
          href="mailto:destek@wasys.pro?subject=Kullan%C4%B1c%C4%B1%20kotas%C4%B1%20art%C4%B1r%C4%B1m%C4%B1"
          className="mt-4 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          Kota artırımı talep et
        </a>
      </div>
    </div>
  );
}
