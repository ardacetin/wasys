"use client";

import { FormEvent, useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Hesap sahibi",
  ADMIN: "Yönetici",
  AGENT: "Temsilci",
};

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [maxUsers, setMaxUsers] = useState(5);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [error, setError] = useState("");
  const [rowError, setRowError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  async function load() {
    const res = await fetch("/api/team");
    const data = await res.json();
    setUsers(data.users ?? []);
    setMaxUsers(data.maxUsers ?? 5);
    setMe(data.me ?? null);
  }

  useEffect(() => {
    void load();
  }, []);

  const canManage = me != null && ["OWNER", "ADMIN"].includes(me.role);

  function canEdit(user: User) {
    if (!canManage || !me) return false;
    if (user.role === "OWNER") return false;
    if (user.role === "ADMIN" && me.role !== "OWNER" && user.id !== me.id) return false;
    return true;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          role: form.get("role"),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kullanıcı eklenemedi");
        return;
      }
      formEl.reset();
      await load();
    } catch {
      setError("Sunucuya ulaşılamadı, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(user: User, role: string) {
    if (role === user.role) return;
    setRowError("");
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/team/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRowError(data.error ?? "Rol değiştirilemedi");
        return;
      }
      await load();
    } finally {
      setBusyId("");
    }
  }

  async function resetPassword(user: User) {
    const password = window.prompt(
      `${user.name} için yeni şifre (en az 6 karakter):`,
    );
    if (!password) return;
    if (password.length < 6) {
      setRowError("Şifre en az 6 karakter olmalı");
      return;
    }
    setRowError("");
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/team/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRowError(data.error ?? "Şifre güncellenemedi");
      }
    } finally {
      setBusyId("");
    }
  }

  async function removeUser(user: User) {
    if (
      !window.confirm(
        `${user.name} (${user.email}) silinecek. Atanmış sohbetleri sahipsiz kalır. Emin misiniz?`,
      )
    ) {
      return;
    }
    setRowError("");
    setBusyId(user.id);
    try {
      const res = await fetch(`/api/team/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setRowError(data.error ?? "Kullanıcı silinemedi");
        return;
      }
      await load();
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Ekip yönetimi</h1>
        <p className="mt-1 text-sm text-ink-muted">
          WASYS · {users.length}/{maxUsers} kullanıcı
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-white/50 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3">Rol</th>
              {canManage ? <th className="px-4 py-3 text-right">İşlemler</th> : null}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const editable = canEdit(u);
              const busy = busyId === u.id;
              return (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {u.name}
                    {me?.id === u.id ? (
                      <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">siz</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                  <td className="px-4 py-3">
                    {editable && u.role !== "OWNER" ? (
                      <select
                        value={u.role}
                        disabled={busy}
                        onChange={(e) => void changeRole(u, e.target.value)}
                        className="rounded-lg border border-line bg-white px-2 py-1 text-sm"
                      >
                        <option value="AGENT">Temsilci</option>
                        <option value="ADMIN">Yönetici</option>
                      </select>
                    ) : (
                      (ROLE_LABELS[u.role] ?? u.role)
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3 text-right">
                      {editable ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void resetPassword(u)}
                            className="rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-white disabled:opacity-50"
                          >
                            Şifre sıfırla
                          </button>
                          {me?.id !== u.id ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void removeUser(u)}
                              className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs font-medium text-danger hover:bg-danger/5 disabled:opacity-50"
                            >
                              Sil
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-ink-muted">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  Yükleniyor…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        {rowError ? (
          <p className="border-t border-line px-4 py-2 text-sm text-danger">{rowError}</p>
        ) : null}
      </div>

      {canManage ? (
        <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-5">
          <h2 className="font-semibold">Kullanıcı ekle</h2>
          <input name="name" required minLength={2} placeholder="Ad soyad" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          <input name="email" type="email" required placeholder="E-posta" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          <input name="password" type="password" required minLength={6} placeholder="Geçici şifre (en az 6 karakter)" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          <select name="role" defaultValue="AGENT" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
            <option value="AGENT">Temsilci</option>
            <option value="ADMIN">Yönetici</option>
          </select>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={saving || users.length >= maxUsers}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Ekleniyor…" : "Ekle"}
          </button>
          {users.length >= maxUsers ? (
            <p className="text-xs text-ink-muted">
              Kullanıcı limitine ulaştınız. Daha fazla kullanıcı için paketinizi yükseltin.
            </p>
          ) : null}
        </form>
      ) : (
        <p className="rounded-2xl border border-line bg-bg-elevated p-5 text-sm text-ink-muted">
          Ekip üyelerini yalnızca yöneticiler düzenleyebilir.
        </p>
      )}
    </div>
  );
}
