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

type OrgUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
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

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Hesap sahibi",
  ADMIN: "Yönetici",
  AGENT: "Temsilci",
};

export default function PlatformAccountsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Seçili organizasyon detayı
  const [openOrgId, setOpenOrgId] = useState<string | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [busyUserId, setBusyUserId] = useState("");
  const [addingUser, setAddingUser] = useState(false);

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

  const loadOrgUsers = useCallback(async (orgId: string) => {
    setUsersLoading(true);
    setDetailError("");
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/users`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error ?? "Kullanıcılar yüklenemedi");
        return;
      }
      setOrgUsers(data.users ?? []);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  function toggleOrg(orgId: string) {
    if (openOrgId === orgId) {
      setOpenOrgId(null);
      setOrgUsers([]);
      return;
    }
    setOpenOrgId(orgId);
    setOrgUsers([]);
    void loadOrgUsers(orgId);
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
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
      if (!res.ok) {
        setError(data.error ?? "Hesap oluşturulamadı");
        return;
      }
      setSuccess(`${data.organization.name} hesabı oluşturuldu.`);
      form.reset();
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function changePlan(org: Organization, plan: string) {
    if (plan === org.plan) return;
    setDetailError("");
    const res = await fetch(`/api/admin/organizations/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDetailError(data.error ?? "Paket değiştirilemedi");
      return;
    }
    await load();
  }

  async function changeMaxUsers(org: Organization, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const maxUsers = Number(fields.get("maxUsers"));
    if (!Number.isInteger(maxUsers) || maxUsers < 1) {
      setDetailError("Kullanıcı limiti 1 veya daha büyük bir tam sayı olmalı");
      return;
    }
    if (maxUsers === org.maxUsers) return;
    setDetailError("");
    const res = await fetch(`/api/admin/organizations/${org.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxUsers }),
    });
    const data = await res.json();
    if (!res.ok) {
      setDetailError(data.error ?? "Kullanıcı limiti güncellenemedi");
      return;
    }
    await load();
  }

  async function deleteOrg(org: Organization) {
    if (
      !window.confirm(
        `${org.name} organizasyonu TÜM verileriyle (kullanıcılar, sohbetler, kişiler) kalıcı olarak silinecek. Emin misiniz?`,
      )
    ) {
      return;
    }
    setDetailError("");
    const res = await fetch(`/api/admin/organizations/${org.id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      setDetailError(data.error ?? "Organizasyon silinemedi");
      return;
    }
    setOpenOrgId(null);
    await load();
  }

  async function addUser(event: FormEvent<HTMLFormElement>, orgId: string) {
    event.preventDefault();
    setDetailError("");
    setAddingUser(true);
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.get("name"),
          email: fields.get("email"),
          password: fields.get("password"),
          role: fields.get("role"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error ?? "Kullanıcı eklenemedi");
        return;
      }
      form.reset();
      await Promise.all([loadOrgUsers(orgId), load()]);
    } finally {
      setAddingUser(false);
    }
  }

  async function changeUserRole(orgId: string, user: OrgUser, role: string) {
    if (role === user.role) return;
    setDetailError("");
    setBusyUserId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error ?? "Rol değiştirilemedi");
        return;
      }
      await loadOrgUsers(orgId);
    } finally {
      setBusyUserId("");
    }
  }

  async function resetUserPassword(user: OrgUser) {
    const password = window.prompt(`${user.name} için yeni şifre (en az 6 karakter):`);
    if (!password) return;
    if (password.length < 6) {
      setDetailError("Şifre en az 6 karakter olmalı");
      return;
    }
    setDetailError("");
    setBusyUserId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) setDetailError(data.error ?? "Şifre güncellenemedi");
    } finally {
      setBusyUserId("");
    }
  }

  async function deleteUser(orgId: string, user: OrgUser) {
    if (!window.confirm(`${user.name} (${user.email}) silinecek. Emin misiniz?`)) {
      return;
    }
    setDetailError("");
    setBusyUserId(user.id);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error ?? "Kullanıcı silinemedi");
        return;
      }
      await Promise.all([loadOrgUsers(orgId), load()]);
    } finally {
      setBusyUserId("");
    }
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
          Dış kayıt kapalıdır. Organizasyonları ve altlarındaki kullanıcıları buradan yönetin.
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
          <p className="mt-1 text-xs text-ink-muted">
            Detay için organizasyona tıklayın: paket, kullanıcılar ve silme işlemleri.
          </p>
        </div>
        {loading ? (
          <p className="p-4 text-sm text-ink-muted">Yükleniyor...</p>
        ) : (
          <div className="divide-y divide-line">
            {organizations.map((org) => {
              const open = openOrgId === org.id;
              return (
                <div key={org.id}>
                  <button
                    type="button"
                    onClick={() => toggleOrg(org.id)}
                    className="grid w-full grid-cols-2 gap-2 px-4 py-3 text-left text-sm transition hover:bg-white/60 md:grid-cols-5"
                  >
                    <div>
                      <div className="font-medium">{org.name}</div>
                      <div className="text-xs text-ink-muted">{org.slug}</div>
                    </div>
                    <div className="text-ink-muted">
                      <div>{org.users[0]?.name ?? "—"}</div>
                      <div className="text-xs">{org.users[0]?.email}</div>
                    </div>
                    <div className="text-xs">
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 font-semibold text-brand">
                        {org.plan}
                      </span>
                    </div>
                    <div className="text-xs text-ink-muted">
                      {org._count.users}/{org.maxUsers} kullanıcı
                    </div>
                    <div className="text-xs text-ink-muted">
                      {org._count.conversations} sohbet · {org._count.contacts} kişi
                    </div>
                  </button>

                  {open ? (
                    <div className="space-y-4 border-t border-line bg-white/40 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Paket:</span>
                          <select
                            value={org.plan}
                            onChange={(e) => void changePlan(org, e.target.value)}
                            className="rounded-lg border border-line bg-white px-2 py-1 text-sm"
                          >
                            <option value="BASIC">Basic</option>
                            <option value="PRO">Pro</option>
                          </select>
                        </label>
                        <form
                          onSubmit={(e) => void changeMaxUsers(org, e)}
                          className="flex items-center gap-2 text-sm"
                        >
                          <span className="font-medium">Kullanıcı limiti:</span>
                          <input
                            key={`${org.id}-${org.maxUsers}`}
                            name="maxUsers"
                            type="number"
                            min={1}
                            max={500}
                            defaultValue={org.maxUsers}
                            className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-sm"
                          />
                          <button
                            type="submit"
                            className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-white"
                          >
                            Kaydet
                          </button>
                        </form>
                        <button
                          type="button"
                          onClick={() => void deleteOrg(org)}
                          className="ml-auto rounded-lg border border-danger/30 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/5"
                        >
                          Organizasyonu sil
                        </button>
                      </div>
                      <p className="text-xs text-ink-muted">
                        Paket değiştirildiğinde kullanıcı limiti paketin varsayılanına döner;
                        gerekiyorsa sonrasında özel limiti tekrar kaydedin.
                      </p>

                      <div className="overflow-hidden rounded-xl border border-line bg-white">
                        <table className="w-full text-left text-sm">
                          <thead className="border-b border-line bg-white/60 text-xs uppercase tracking-wide text-ink-muted">
                            <tr>
                              <th className="px-3 py-2">Ad</th>
                              <th className="px-3 py-2">E-posta</th>
                              <th className="px-3 py-2">Rol</th>
                              <th className="px-3 py-2 text-right">İşlemler</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usersLoading ? (
                              <tr>
                                <td colSpan={4} className="px-3 py-4 text-center text-ink-muted">
                                  Yükleniyor...
                                </td>
                              </tr>
                            ) : (
                              orgUsers.map((user) => {
                                const busy = busyUserId === user.id;
                                return (
                                  <tr key={user.id} className="border-b border-line last:border-0">
                                    <td className="px-3 py-2 font-medium">{user.name}</td>
                                    <td className="px-3 py-2 text-ink-muted">{user.email}</td>
                                    <td className="px-3 py-2">
                                      <select
                                        value={user.role}
                                        disabled={busy}
                                        onChange={(e) =>
                                          void changeUserRole(org.id, user, e.target.value)
                                        }
                                        className="rounded-lg border border-line bg-white px-2 py-1 text-xs"
                                      >
                                        <option value="OWNER">{ROLE_LABELS.OWNER}</option>
                                        <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                                        <option value="AGENT">{ROLE_LABELS.AGENT}</option>
                                      </select>
                                    </td>
                                    <td className="px-3 py-2">
                                      <div className="flex justify-end gap-2">
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => void resetUserPassword(user)}
                                          className="rounded-lg border border-line px-2 py-1 text-xs text-ink-muted hover:bg-white disabled:opacity-50"
                                        >
                                          Şifre sıfırla
                                        </button>
                                        <button
                                          type="button"
                                          disabled={busy}
                                          onClick={() => void deleteUser(org.id, user)}
                                          className="rounded-lg border border-danger/30 px-2 py-1 text-xs text-danger hover:bg-danger/5 disabled:opacity-50"
                                        >
                                          Sil
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>

                      <form
                        onSubmit={(e) => void addUser(e, org.id)}
                        className="grid gap-2 rounded-xl border border-line bg-white p-3 md:grid-cols-5"
                      >
                        <input
                          name="name"
                          required
                          minLength={2}
                          placeholder="Ad soyad"
                          className="rounded-lg border border-line px-2 py-1.5 text-sm"
                        />
                        <input
                          name="email"
                          type="email"
                          required
                          placeholder="E-posta"
                          className="rounded-lg border border-line px-2 py-1.5 text-sm"
                        />
                        <input
                          name="password"
                          type="password"
                          required
                          minLength={6}
                          placeholder="Geçici şifre"
                          className="rounded-lg border border-line px-2 py-1.5 text-sm"
                        />
                        <select
                          name="role"
                          defaultValue="AGENT"
                          className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="AGENT">{ROLE_LABELS.AGENT}</option>
                          <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                          <option value="OWNER">{ROLE_LABELS.OWNER}</option>
                        </select>
                        <button
                          type="submit"
                          disabled={addingUser}
                          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          {addingUser ? "Ekleniyor..." : "Kullanıcı ekle"}
                        </button>
                      </form>

                      {detailError ? (
                        <p className="text-sm text-danger">{detailError}</p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!organizations.length ? (
              <p className="p-4 text-sm text-ink-muted">Henüz müşteri hesabı yok.</p>
            ) : null}
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
