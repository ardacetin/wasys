import { requireSession } from "@/lib/session";
import { PLAN_LIMITS, planLabel } from "@/lib/plans";
import type { Plan } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PlanUpgradeButton } from "./upgrade-button";

export default async function PlanPage() {
  const session = await requireSession();
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: session.user.organizationId },
  });
  const plan = org.plan as Plan;
  const features = PLAN_LIMITS[plan].features;

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Paket</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Aktif plan: <strong>{planLabel(plan)}</strong>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(["BASIC", "PRO"] as Plan[]).map((p) => {
          const active = p === plan;
          const f = PLAN_LIMITS[p].features;
          return (
            <div
              key={p}
              className={`rounded-2xl border p-5 ${active ? "border-brand bg-brand-soft/40" : "border-line bg-bg-elevated"}`}
            >
              <div className="font-[family-name:var(--font-display)] text-2xl">{planLabel(p)}</div>
              <p className="mt-1 text-sm text-ink-muted">En fazla {PLAN_LIMITS[p].maxUsers} kullanıcı</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>Ortak gelen kutusu</li>
                <li>Etiketleme & filtreleme</li>
                <li>Şablonlar & sesli mesaj</li>
                <li className={f.intentAi ? "" : "text-ink-muted"}>
                  Intent AI {f.intentAi ? "" : "(Pro)"}
                </li>
                <li className={f.callCenter ? "" : "text-ink-muted"}>
                  Çağrı merkezi {f.callCenter ? "" : "(Pro)"}
                </li>
                <li className={f.apiAccess ? "" : "text-ink-muted"}>
                  API & entegrasyonlar {f.apiAccess ? "" : "(Pro)"}
                </li>
              </ul>
              {p === "PRO" && plan !== "PRO" ? <PlanUpgradeButton /> : null}
              {active ? (
                <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand">Aktif</div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-line bg-white p-5 text-sm">
        <h2 className="font-semibold">Bu pakette açık özellikler</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {Object.entries(features).map(([key, enabled]) => (
            <div key={key} className={enabled ? "text-ok" : "text-ink-muted"}>
              {enabled ? "✓" : "–"} {key}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
