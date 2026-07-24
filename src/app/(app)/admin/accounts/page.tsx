"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Organization = {
  id: string;
  name: string;
  slug: string;
  plan: "BASIC" | "PRO";
  maxUsers: number;
  createdAt: string;
  users: { name: string; email: string }[];
  _count: { users: number; contacts: number; conversations: number };
};

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

export default function PlatformAccountsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [res, quotesRes] = await Promise.all([
      fetch("/api/admin/organizations", { cache: "no-store" }),
      fetch("/api/admin/quote-requests", { cache: "no-store" }),
    ]);
    const [data, quotesData] = await Promise.all([res.json(), quotesRes.json()]);
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Hesaplar yüklenemedi");
      return;
    }
    setOrganizations(data.organizations ?? []);
    if (quotesRes.ok) setQuoteRequests(quotesData.quoteRequests ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    const form = event.currentTarget;
    const fields = new FormData(form);
    const res = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationName: fields.get("organizationName"),
        ownerName: fields.get("ownerName"),
        ownerEmail: fields.get("ownerEmail"),
        temporaryPassword: fields.get("temporaryPassword"),
        plan: fields.get("plan"),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Hesap oluşturulamadı");
      return;
    }
    setSuccess(`${data.organization.name} hesabı oluşturuldu.`);
    form.reset();
    void load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Platform yönetimi
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          SaaS müşteri hesapları
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Dış kayıt kapalıdır. Yeni organizasyon ve ilk owner hesabını yalnızca buradan açın.
        </p>
      </div>

      <form
        onSubmit={createAccount}
        className="grid gap-4 rounded-2xl border border-line bg-bg-elevated p-5 md:grid-cols-2"
      >
        <h2 className="font-semibold md:col-span-2">Yeni müşteri hesabı</h2>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Organizasyon</span>
          <input
            name="organizationName"
            required
            className="w-full rounded-xl border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Paket</span>
          <select
            name="plan"
            defaultValue="BASIC"
            className="w-full rounded-xl border border-line bg-white px-3 py-2"
          >
            <option value="BASIC">Basic</option>
            <option value="PRO">Pro</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Owner adı</span>
          <input
            name="ownerName"
            required
            className="w-full rounded-xl border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium">Owner e-posta</span>
          <input
            name="ownerEmail"
            type="email"
            required
            className="w-full rounded-xl border border-line bg-white px-3 py-2"
          />
        </label>
        <label className="text-sm md:col-span-2">
          <span className="mb-1 block font-medium">Geçici şifre (en az 8 karakter)</span>
          <input
            name="temporaryPassword"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className="w-full rounded-xl border border-line bg-white px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
        {success ? <p className="text-sm text-ok md:col-span-2">{success}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2"
        >
          {saving ? "Oluşturuluyor..." : "Müşteri hesabını oluştur"}
        </button>
      </form>

      <section className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">Organizasyonlar</h2>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-ink-muted">Yükleniyor...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/60 text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Organizasyon</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Paket</th>
                  <th className="px-4 py-3">Kullanıcı</th>
                  <th className="px-4 py-3">Sohbet</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.id} className="border-t border-line">
                    <td className="px-4 py-3">
                      <div className="font-medium">{org.name}</div>
                      <div className="text-xs text-ink-muted">{org.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{org.users[0]?.name ?? "—"}</div>
                      <div className="text-xs text-ink-muted">{org.users[0]?.email}</div>
                    </td>
                    <td className="px-4 py-3">{org.plan}</td>
                    <td className="px-4 py-3">
                      {org._count.users}/{org.maxUsers}
                    </td>
                    <td className="px-4 py-3">{org._count.conversations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        <div className="border-b border-line p-4">
          <h2 className="font-semibold">Teklif talepleri</h2>
          <p className="mt-1 text-xs text-ink-muted">Ana sayfadaki formdan gelen son 100 talep</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/60 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">İletişim</th>
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Kullanıcı</th>
                <th className="px-4 py-3">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {quoteRequests.map((quote) => (
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
                  <td className="px-4 py-3">{quote.plan}</td>
                  <td className="px-4 py-3">{quote.userCount}</td>
                  <td className="px-4 py-3 text-xs text-ink-muted">
                    {new Date(quote.createdAt).toLocaleString("tr-TR")}
                  </td>
                </tr>
              ))}
              {!quoteRequests.length ? (
                <tr>
                  <td className="px-4 py-6 text-center text-ink-muted" colSpan={4}>
                    Henüz teklif talebi yok.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
