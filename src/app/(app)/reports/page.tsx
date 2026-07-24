"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Granularity = "hour" | "day" | "week" | "month";
type Preset = "today" | "yesterday" | "7d" | "30d" | "month";

type Report = {
  generatedAt: string;
  range: { from: string; to: string; granularity: Granularity };
  summary: {
    totalOutbound: number;
    totalInbound: number;
    totalMessages: number;
    uniqueContactsMessaged: number;
    conversationsStartedByUs: number;
    conversationsStartedByCustomer: number;
  };
  series: { key: string; label: string; inbound: number; outbound: number; total: number }[];
  byAgent: {
    id: string;
    name: string;
    role: string;
    outbound: number;
    uniqueContacts: number;
    conversationsStarted: number;
  }[];
};

const GRANULARITY_OPTIONS: { value: Granularity; label: string }[] = [
  { value: "hour", label: "Saatlik" },
  { value: "day", label: "Günlük" },
  { value: "week", label: "Haftalık" },
  { value: "month", label: "Aylık" },
];

const PRESET_OPTIONS: { value: Preset; label: string }[] = [
  { value: "today", label: "Bugün" },
  { value: "yesterday", label: "Dün" },
  { value: "7d", label: "Son 7 gün" },
  { value: "30d", label: "Son 30 gün" },
  { value: "month", label: "Bu ay" },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Sahip",
  ADMIN: "Yönetici",
  AGENT: "Temsilci",
};

function presetRange(preset: Preset): { from: Date; to: Date } {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  switch (preset) {
    case "today":
      return { from: startOfToday, to: now };
    case "yesterday": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 1);
      const to = new Date(startOfToday);
      to.setMilliseconds(-1);
      return { from, to };
    }
    case "7d": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 6);
      return { from, to: now };
    }
    case "30d": {
      const from = new Date(startOfToday);
      from.setDate(from.getDate() - 29);
      return { from, to: now };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: now };
    }
  }
}

function MessageChart({
  series,
}: {
  series: Report["series"];
}) {
  const chart = useMemo(() => {
    const n = series.length;
    if (n === 0) return null;

    const groupWidth = 26;
    const barWidth = 9;
    const chartHeight = 220;
    const paddingTop = 12;
    const paddingBottom = 34;
    const paddingLeft = 36;
    const width = paddingLeft + n * groupWidth + 12;
    const height = chartHeight + paddingTop + paddingBottom;

    const rawMax = Math.max(1, ...series.map((s) => Math.max(s.inbound, s.outbound)));
    // Round up to a "nice" max for gridlines
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
    const niceMax = Math.ceil(rawMax / magnitude) * magnitude;
    const gridSteps = 4;

    // Show at most ~10 x-axis labels
    const labelEvery = Math.max(1, Math.ceil(n / 10));

    return { n, groupWidth, barWidth, chartHeight, paddingTop, paddingBottom, paddingLeft, width, height, niceMax, gridSteps, labelEvery };
  }, [series]);

  if (!chart) {
    return <div className="py-12 text-center text-sm text-ink-muted">Bu aralıkta veri yok.</div>;
  }

  const { n, groupWidth, barWidth, chartHeight, paddingTop, paddingLeft, width, height, niceMax, gridSteps, labelEvery } = chart;
  const y = (value: number) => paddingTop + chartHeight - (value / niceMax) * chartHeight;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        role="img"
        aria-label="Gönderilen ve alınan mesaj grafiği"
        className="min-w-full"
      >
        {/* Gridlines + y labels */}
        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const value = Math.round((niceMax / gridSteps) * i);
          const yy = y(value);
          return (
            <g key={i}>
              <line x1={paddingLeft} y1={yy} x2={width - 4} y2={yy} stroke="var(--line, #e5e7eb)" strokeWidth={1} strokeDasharray={i === 0 ? undefined : "3 4"} />
              <text x={paddingLeft - 6} y={yy + 3} textAnchor="end" fontSize={9} fill="currentColor" opacity={0.5}>
                {value}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {series.map((s, i) => {
          const groupX = paddingLeft + i * groupWidth + (groupWidth - barWidth * 2 - 2) / 2;
          const outH = Math.max(s.outbound > 0 ? 2 : 0, (s.outbound / niceMax) * chartHeight);
          const inH = Math.max(s.inbound > 0 ? 2 : 0, (s.inbound / niceMax) * chartHeight);
          return (
            <g key={s.key}>
              <title>{`${s.label} · Gönderilen ${s.outbound} · Alınan ${s.inbound}`}</title>
              <rect x={groupX} y={paddingTop + chartHeight - outH} width={barWidth} height={outH} rx={2} fill="var(--brand)" />
              <rect x={groupX + barWidth + 2} y={paddingTop + chartHeight - inH} width={barWidth} height={inH} rx={2} fill="var(--accent)" />
              {i % labelEvery === 0 && (
                <text
                  x={paddingLeft + i * groupWidth + groupWidth / 2}
                  y={paddingTop + chartHeight + 16}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill="currentColor"
                  opacity={0.55}
                >
                  {n > 20 ? s.label.split(" ").slice(0, 2).join(" ") : s.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function InitiationBar({ us, customer }: { us: number; customer: number }) {
  const total = us + customer;
  const usPct = total === 0 ? 50 : Math.round((us / total) * 100);
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full border border-line">
        <div className="bg-brand transition-all" style={{ width: `${usPct}%` }} title={`Biz başlattık: ${us}`} />
        <div className="bg-accent transition-all" style={{ width: `${100 - usPct}%` }} title={`Müşteri başlattı: ${customer}`} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand" />
          Biz başlattık · <strong className="text-ink">{us}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent" />
          Müşteri başlattı · <strong className="text-ink">{customer}</strong>
        </span>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>("7d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { from, to } = presetRange(preset);
      const qs = new URLSearchParams({
        granularity,
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const res = await fetch(`/api/reports?${qs.toString()}`);
      if (!res.ok) throw new Error("Rapor alınamadı");
      const data = (await res.json()) as Report;
      setReport(data);
    } catch {
      setError("Rapor yüklenirken bir hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }, [preset, granularity]);

  useEffect(() => {
    void load();
  }, [load]);

  function selectPreset(next: Preset) {
    setPreset(next);
    // Sensible default granularity for each range
    if (next === "today" || next === "yesterday") setGranularity("hour");
    else if (granularity === "hour") setGranularity("day");
  }

  const summaryCards = report
    ? [
        { label: "Gönderilen mesaj", value: report.summary.totalOutbound },
        { label: "Alınan mesaj", value: report.summary.totalInbound },
        { label: "Ulaşılan kişi", value: report.summary.uniqueContactsMessaged },
        { label: "Bizim başlattığımız sohbet", value: report.summary.conversationsStartedByUs },
        { label: "Müşterinin başlattığı sohbet", value: report.summary.conversationsStartedByCustomer },
      ]
    : [];

  const tableRows = report ? [...report.series].reverse() : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">Raporlar</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Mesaj trafiği, ulaşılan kişiler ve sohbet başlatma analizi
            {report && (
              <>
                {" "}· güncellendi {new Date(report.generatedAt).toLocaleTimeString("tr-TR")}
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-bg-elevated"
        >
          Yenile
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-line bg-bg-elevated p-1">
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => selectPreset(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                preset === opt.value ? "bg-brand text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl border border-line bg-bg-elevated p-1">
          {GRANULARITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setGranularity(opt.value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                granularity === opt.value ? "bg-brand text-white" : "text-ink-muted hover:text-ink"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {loading && <span className="text-xs text-ink-muted">Yükleniyor…</span>}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!report && !error && (
        <div className="p-6 text-sm text-ink-muted">Rapor yükleniyor…</div>
      )}

      {report && (
        <>
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {summaryCards.map((card) => (
              <div key={card.label} className="rounded-2xl border border-line bg-bg-elevated p-4">
                <div className="text-xs uppercase tracking-wide text-ink-muted">{card.label}</div>
                <div className="mt-2 font-[family-name:var(--font-display)] text-3xl">
                  {card.value.toLocaleString("tr-TR")}
                </div>
              </div>
            ))}
          </div>

          {/* Initiation breakdown */}
          <div className="rounded-2xl border border-line bg-bg-elevated p-5">
            <h2 className="font-semibold">Sohbet başlatma dağılımı</h2>
            <p className="mt-1 text-xs text-ink-muted">
              Seçili aralıkta oluşturulan sohbetlerin ilk mesajına göre
            </p>
            <div className="mt-4">
              <InitiationBar
                us={report.summary.conversationsStartedByUs}
                customer={report.summary.conversationsStartedByCustomer}
              />
            </div>
          </div>

          {/* Time series chart */}
          <div className="rounded-2xl border border-line bg-bg-elevated p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">Mesaj trafiği</h2>
              <div className="flex gap-4 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand" /> Gönderilen
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-accent" /> Alınan
                </span>
              </div>
            </div>
            <div className="mt-4">
              <MessageChart series={report.series} />
            </div>
          </div>

          {/* Time series table */}
          <div className="rounded-2xl border border-line bg-bg-elevated">
            <div className="border-b border-line p-5 pb-3">
              <h2 className="font-semibold">Dönem detayı</h2>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-bg-elevated text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Dönem</th>
                    <th className="px-5 py-2.5 text-right font-medium">Gönderilen</th>
                    <th className="px-5 py-2.5 text-right font-medium">Alınan</th>
                    <th className="px-5 py-2.5 text-right font-medium">Toplam</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-ink-muted">
                        Bu aralıkta veri yok.
                      </td>
                    </tr>
                  )}
                  {tableRows.map((row) => (
                    <tr key={row.key} className="border-t border-line/60">
                      <td className="px-5 py-2.5">{row.label}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {row.outbound.toLocaleString("tr-TR")}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {row.inbound.toLocaleString("tr-TR")}
                      </td>
                      <td className="px-5 py-2.5 text-right font-semibold tabular-nums">
                        {row.total.toLocaleString("tr-TR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Per-agent table */}
          <div className="rounded-2xl border border-line bg-bg-elevated">
            <div className="border-b border-line p-5 pb-3">
              <h2 className="font-semibold">Temsilci performansı</h2>
              <p className="mt-1 text-xs text-ink-muted">
                Seçili aralıkta ekip üyelerinin gönderdiği mesajlar
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-ink-muted">
                  <tr>
                    <th className="px-5 py-2.5 font-medium">Ekip üyesi</th>
                    <th className="px-5 py-2.5 font-medium">Rol</th>
                    <th className="px-5 py-2.5 text-right font-medium">Gönderilen mesaj</th>
                    <th className="px-5 py-2.5 text-right font-medium">Ulaşılan kişi</th>
                    <th className="px-5 py-2.5 text-right font-medium">Başlattığı sohbet</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byAgent.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-6 text-center text-ink-muted">
                        Kayıtlı ekip üyesi yok.
                      </td>
                    </tr>
                  )}
                  {report.byAgent.map((agent) => (
                    <tr key={agent.id} className="border-t border-line/60">
                      <td className="px-5 py-2.5 font-medium">{agent.name}</td>
                      <td className="px-5 py-2.5 text-ink-muted">
                        {ROLE_LABELS[agent.role] ?? agent.role}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {agent.outbound.toLocaleString("tr-TR")}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {agent.uniqueContacts.toLocaleString("tr-TR")}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {agent.conversationsStarted.toLocaleString("tr-TR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
