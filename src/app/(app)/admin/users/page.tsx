"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  organization: {
    id: string;
    name: string;
    plan: string;
    maxUsers: number;
  };
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Hesap sahibi",
  ADMIN: "Yönetici / Süpervizör",
  AGENT: "Temsilci",
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kullanıcılar yüklenemedi");
        return;
      }
      setUsers(data.users ?? []);
    })();
  }, []);

  const filtered = users.filter((u) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return (
      u.name.toLowerCase().includes(needle) ||
      u.email.toLowerCase().includes(needle) ||
      u.organization.name.toLowerCase().includes(needle)
    );
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
          Platform yönetimi
        </p>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
          Tüm kullanıcılar
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Tüm müşteri hesaplarındaki hesap sahipleri, yöneticiler ve temsilciler.
        </p>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ad, e-posta veya organizasyon ara…"
        className="w-full max-w-md rounded-xl border border-line bg-white px-3 py-2 text-sm"
      />

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/60 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Kullanıcı</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Organizasyon</th>
              <th className="px-4 py-3">Kota</th>
              <th className="px-4 py-3">Kayıt</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-ink-muted">{u.email}</div>
                </td>
                <td className="px-4 py-3">{ROLE_LABELS[u.role] ?? u.role}</td>
                <td className="px-4 py-3">
                  <Link
                    href="/admin/accounts"
                    className="text-brand hover:underline"
                  >
                    {u.organization.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-muted">
                  {u.organization.maxUsers} kullanıcı
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {new Date(u.createdAt).toLocaleDateString("tr-TR")}
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  Kullanıcı bulunamadı.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
