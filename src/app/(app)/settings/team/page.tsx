"use client";

import { FormEvent, useEffect, useState } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function TeamPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [plan, setPlan] = useState("BASIC");
  const [maxUsers, setMaxUsers] = useState(5);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/team");
    const data = await res.json();
    setUsers(data.users ?? []);
    setPlan(data.plan ?? "BASIC");
    setMaxUsers(data.maxUsers ?? 5);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
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
      setError(data.error ?? "Eklenemedi");
      return;
    }
    e.currentTarget.reset();
    void load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Ekip yönetimi</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {plan} paket · {users.length}/{maxUsers} kullanıcı
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-bg-elevated">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-white/50 text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Ad</th>
              <th className="px-4 py-3">E-posta</th>
              <th className="px-4 py-3">Rol</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3 text-ink-muted">{u.email}</td>
                <td className="px-4 py-3">{u.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-5">
        <h2 className="font-semibold">Kullanıcı ekle</h2>
        <input name="name" required placeholder="Ad soyad" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        <input name="email" type="email" required placeholder="E-posta" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        <input name="password" type="password" required minLength={6} placeholder="Geçici şifre" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        <select name="role" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="AGENT">AGENT</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
          Ekle
        </button>
      </form>
    </div>
  );
}
