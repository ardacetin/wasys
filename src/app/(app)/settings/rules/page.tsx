"use client";

import { FormEvent, useEffect, useState } from "react";

type Rule = {
  id: string;
  name: string;
  matchType: string;
  matchValue: string | null;
  priority: number;
  isActive: boolean;
  assignTo: { id: string; name: string } | null;
};

type TeamUser = { id: string; name: string };

export default function AssignmentRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const [rulesRes, teamRes] = await Promise.all([
      fetch("/api/assignment-rules"),
      fetch("/api/team"),
    ]);
    const rulesData = await rulesRes.json();
    const teamData = await teamRes.json();
    setRules(rulesData.rules ?? []);
    setTeam(teamData.users ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/assignment-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        matchType: form.get("matchType"),
        matchValue: form.get("matchValue") || null,
        assignToId: form.get("assignToId") || null,
        priority: Number(form.get("priority") || 100),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Kayıt başarısız");
      return;
    }
    e.currentTarget.reset();
    void load();
  }

  async function toggle(rule: Rule) {
    await fetch(`/api/assignment-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    void load();
  }

  async function remove(id: string) {
    if (!confirm("Kural silinsin mi?")) return;
    await fetch(`/api/assignment-rules/${id}`, { method: "DELETE" });
    void load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Atama kuralları</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Gelen mesajları anahtar kelime, kanal veya atanmamış sohbetlere göre otomatik yönlendirin.
        </p>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="rounded-2xl border border-line bg-bg-elevated p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{rule.name}</div>
                <div className="mt-1 text-xs text-ink-muted">
                  {rule.matchType}
                  {rule.matchValue ? ` · ${rule.matchValue}` : ""} · öncelik {rule.priority} ·{" "}
                  {rule.assignTo?.name ?? "round-robin"}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void toggle(rule)}
                  className="rounded-lg border border-line px-3 py-1 text-xs"
                >
                  {rule.isActive ? "Aktif" : "Pasif"}
                </button>
                <button
                  onClick={() => void remove(rule.id)}
                  className="rounded-lg border border-line px-3 py-1 text-xs text-danger"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        ))}
        {!rules.length ? <p className="text-sm text-ink-muted">Henüz kural yok.</p> : null}
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-5">
        <h2 className="font-semibold">Yeni kural</h2>
        <input name="name" required placeholder="Kural adı" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        <select name="matchType" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="KEYWORD">KEYWORD — mesajda kelime</option>
          <option value="CHANNEL">CHANNEL — kanal id veya *</option>
          <option value="TAG">TAG — etiket id</option>
          <option value="UNASSIGNED">UNASSIGNED — atanmamış / yeni</option>
        </select>
        <input name="matchValue" placeholder="Eşleşme değeri (opsiyonel)" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        <select name="assignToId" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm">
          <option value="">Round-robin (en az yük)</option>
          {team.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <input name="priority" type="number" defaultValue={100} min={1} className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
          Kural ekle
        </button>
      </form>
    </div>
  );
}
