import { requireSession } from "@/lib/session";
import { PLAN_LIMITS, planLabel, type FeatureKey } from "@/lib/plans";
import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db";

const FEATURE_LABELS: Record<FeatureKey, string> = {
  sharedInbox: "Ortak gelen kutusu",
  tags: "Etiketleme & filtreleme",
  templates: "Hazır mesaj şablonları",
  voiceMessages: "Sesli mesajlar",
  multiUserChat: "Çoklu kullanıcı sohbeti",
  mobileApp: "Mobil uygulama",
  assignmentRules: "Otomatik atama kuralları",
  reporting: "Raporlama",
  intentAi: "Intent AI (niyet analizi)",
  zoho: "Zoho entegrasyonu",
  shopify: "Shopify entegrasyonu",
  callCenter: "Çağrı merkezi",
  apiAccess: "API erişimi",
  prioritySupport: "Öncelikli destek",
};

export default async function PlanPage() {
  const session = await requireSession();
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.user.organizationId },
    include: { _count: { select: { users: true } } },
  });
  const plan = org.plan as Plan;
  const features = PLAN_LIMITS[plan].features;
  const usagePercent = Math.min(
    100,
    Math.round((org._count.users / Math.max(org.maxUsers, 1)) * 100),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Paket</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {org.name} organizasyonunun aktif planı ve kullanım limitleri
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-brand bg-brand-soft/40 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">Aktif plan</p>
          <div className="mt-1 font-[family-name:var(--font-display)] text-3xl">
            {planLabel(plan)}
          </div>
          <p className="mt-2 text-sm text-ink-muted">
            Plan değişiklikleri WASYS sistem yöneticisi tarafından yapılır.
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-bg-elevated p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Kullanıcı limiti
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
              ? "Limitiniz doldu. Artırmak için WASYS yöneticisiyle iletişime geçin."
              : `${org.maxUsers - org._count.users} kullanıcı hakkınız kaldı.`}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">Paketinize dahil özellikler</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(Object.entries(features) as [FeatureKey, boolean][]).map(([key, enabled]) => (
            <div key={key} className={enabled ? "text-ok" : "text-ink-muted"}>
              {enabled ? "✓" : "–"} {FEATURE_LABELS[key]}
              {!enabled ? <span className="ml-1 text-xs">(Pro)</span> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-bg-elevated p-5 text-sm">
        <h2 className="font-semibold">Plan değişikliği mi gerekiyor?</h2>
        <p className="mt-2 text-ink-muted">
          Paket yükseltme, kullanıcı limiti artırma ve özel plan talepleri için WASYS sistem
          yöneticinizle iletişime geçin. Planınız size özel olarak yönetici panelinden
          tanımlanır.
        </p>
        <a
          href="mailto:destek@wasys.pro?subject=Plan%20de%C4%9Fi%C5%9Fikli%C4%9Fi%20talebi"
          className="mt-4 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          Plan değişikliği talep et
        </a>
      </div>
    </div>
  );
}
