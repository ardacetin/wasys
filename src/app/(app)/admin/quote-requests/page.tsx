"use client";

import { useEffect, useState } from "react";

type QuoteRequest = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  userCount: number;
  plan: string;
  status: string;
  createdAt: string;
};

export default function AdminQuoteRequestsPage() {
  const [quotes, setQuotes] = useState<QuoteRequest[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function load() {
    const res = await fetch("/api/admin/quote-requests", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Talepler yüklenemedi");
      return;
    }
    setQuotes(data.quoteRequests ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function markContacted(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/quote-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "CONTACTED" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Güncellenemedi");
        return;
      }
      await load();
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Platform yönetimi
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          Teklif talepleri
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Ana sayfadaki formdan gelen demo / teklif istekleri.
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/60 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">İletişim</th>
              <th className="px-4 py-3">Kullanıcı sayısı</th>
              <th className="px-4 py-3">Durum</th>
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="font-medium">{quote.fullName}</div>
                  <a className="block text-xs text-brand" href={`mailto:${quote.email}`}>
                    {quote.email}
                  </a>
                  <a className="block text-xs text-ink-muted" href={`tel:${quote.phone}`}>
                    {quote.phone}
                  </a>
                </td>
                <td className="px-4 py-3 font-medium">{quote.userCount}</td>
                <td className="px-4 py-3">{quote.status}</td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {new Date(quote.createdAt).toLocaleString("tr-TR")}
                </td>
                <td className="px-4 py-3 text-right">
                  {quote.status === "NEW" ? (
                    <button
                      type="button"
                      disabled={busyId === quote.id}
                      onClick={() => void markContacted(quote.id)}
                      className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium hover:bg-white disabled:opacity-50"
                    >
                      İletişime geçildi
                    </button>
                  ) : (
                    <span className="text-xs text-ink-muted">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!quotes.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  Henüz teklif talebi yok.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
