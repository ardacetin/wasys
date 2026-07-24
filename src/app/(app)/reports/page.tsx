"use client";

import { useEffect, useState } from "react";

type Report = {
  generatedAt: string;
  summary: {
    openConversations: number;
    unassigned: number;
    messages24h: number;
    inbound24h: number;
    outbound24h: number;
    contactsTotal: number;
  };
  byAgent: { id: string; name: string; openAssigned: number }[];
  daily: { date: string; inbound: number; outbound: number }[];
  tags: { id: string; name: string; color: string; count: number }[];
};

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);

  async function load() {
    const res = await fetch("/api/reports");
    const data = await res.json();
    setReport(data);
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, []);

  if (!report) {
    return <div className="p-6 text-sm text-ink-muted">Rapor yükleniyor…</div>;
  }

  const maxDaily = Math.max(1, ...report.daily.map((d) => d.inbound + d.outbound));

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Raporlar</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Gerçek zamanlı özet · güncellendi{" "}
            {new Date(report.generatedAt).toLocaleTimeString("tr-TR")}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold"
        >
          Yenile
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Açık sohbet", report.summary.openConversations],
          ["Atanmamış", report.summary.unassigned],
          ["Mesaj (24s)", report.summary.messages24h],
          ["Gelen (24s)", report.summary.inbound24h],
          ["Giden (24s)", report.summary.outbound24h],
          ["Kişiler", report.summary.contactsTotal],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-line bg-bg-elevated p-4">
            <div className="text-xs uppercase tracking-wide text-ink-muted">{label}</div>
            <div className="mt-2 font-[family-name:var(--font-display)] text-3xl">{value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-bg-elevated p-5">
        <h2 className="font-semibold">Son 7 gün</h2>
        <div className="mt-4 flex h-40 items-end gap-2">
          {report.daily.map((d) => {
            const total = d.inbound + d.outbound;
            const h = Math.round((total / maxDaily) * 100);
            return (
              <div key={d.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-28 w-full items-end justify-center gap-0.5">
                  <div
                    className="w-1/2 rounded-t bg-brand/70"
                    style={{ height: `${Math.max(4, (d.inbound / maxDaily) * 100)}%` }}
                    title={`Gelen ${d.inbound}`}
                  />
                  <div
                    className="w-1/2 rounded-t bg-accent/80"
                    style={{ height: `${Math.max(4, (d.outbound / maxDaily) * 100)}%` }}
                    title={`Giden ${d.outbound}`}
                  />
                </div>
                <div className="text-[10px] text-ink-muted">{d.date.slice(5)}</div>
                <div className="sr-only">{h}</div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-brand/70" /> Gelen
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-accent/80" /> Giden
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-bg-elevated p-5">
          <h2 className="font-semibold">Temsilci yükü</h2>
          <div className="mt-3 space-y-2">
            {report.byAgent.map((a) => (
              <div key={a.id} className="flex justify-between text-sm">
                <span>{a.name}</span>
                <span className="font-semibold">{a.openAssigned}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-bg-elevated p-5">
          <h2 className="font-semibold">Etiket dağılımı</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {report.tags.map((t) => (
              <span
                key={t.id}
                className="rounded-full px-3 py-1 text-xs font-medium text-white"
                style={{ background: t.color }}
              >
                {t.name} · {t.count}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
