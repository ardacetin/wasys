"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  organizations: number;
  users: number;
  quoteRequests: number;
  openQuotes: number;
  conversations: number;
  contacts: number;
};

type RecentOrg = {
  id: string;
  name: string;
  plan: string;
  maxUsers: number;
  createdAt: string;
  _count: { users: number };
};

type RecentQuote = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  userCount: number;
  plan: string;
  status: string;
  createdAt: string;
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrgs, setRecentOrgs] = useState<RecentOrg[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<RecentQuote[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/overview", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Özet yüklenemedi");
        return;
      }
      setStats(data.stats);
      setRecentOrgs(data.recentOrgs ?? []);
      setRecentQuotes(data.recentQuotes ?? []);
    })();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          WASYS Platform
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          SaaS kontrol paneli
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Müşteri hesapları, kullanıcılar ve teklif talepleri buradan yönetilir.
        </p>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Müşteri hesapları", value: stats?.organizations, href: "/admin/accounts" },
          { label: "Toplam kullanıcı", value: stats?.users, href: "/admin/users" },
          { label: "Teklif talepleri", value: stats?.quoteRequests, href: "/admin/quote-requests" },
          { label: "Açık talepler", value: stats?.openQuotes, href: "/admin/quote-requests" },
          { label: "Toplam sohbet", value: stats?.conversations },
          { label: "Toplam kişi (CRM)", value: stats?.contacts },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-line bg-bg-elevated p-5"
          >
            <div className="text-xs uppercase tracking-wide text-ink-muted">
              {card.label}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">
              {card.value ?? "—"}
            </div>
            {card.href ? (
              <Link
                href={card.href}
                className="mt-3 inline-block text-xs font-medium text-brand hover:underline"
              >
                Görüntüle →
              </Link>
            ) : null}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 className="font-semibold">Son müşteriler</h2>
            <Link href="/admin/accounts" className="text-xs text-brand hover:underline">
              Tümü
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {recentOrgs.map((org) => (
              <li key={org.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <div className="font-medium">{org.name}</div>
                  <div className="text-xs text-ink-muted">
                    {org._count.users}/{org.maxUsers} kullanıcı
                  </div>
                </div>
                <div className="text-xs text-ink-muted">
                  {new Date(org.createdAt).toLocaleDateString("tr-TR")}
                </div>
              </li>
            ))}
            {!recentOrgs.length ? (
              <li className="px-4 py-6 text-center text-sm text-ink-muted">
                Henüz müşteri yok.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 className="font-semibold">Son talepler</h2>
            <Link
              href="/admin/quote-requests"
              className="text-xs text-brand hover:underline"
            >
              Tümü
            </Link>
          </div>
          <ul className="divide-y divide-line">
            {recentQuotes.map((q) => (
              <li key={q.id} className="px-4 py-3 text-sm">
                <div className="font-medium">{q.fullName}</div>
                <div className="text-xs text-ink-muted">
                  {q.email} · {q.userCount} kullanıcı · {q.plan}
                </div>
              </li>
            ))}
            {!recentQuotes.length ? (
              <li className="px-4 py-6 text-center text-sm text-ink-muted">
                Henüz talep yok.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}
