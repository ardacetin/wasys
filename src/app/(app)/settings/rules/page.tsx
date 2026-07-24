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
type Channel = { id: string; name: string };
type Tag = { id: string; name: string };

const MATCH_LABELS: Record<string, string> = {
  KEYWORD: "Anahtar kelime",
  CHANNEL: "Kanal",
  TAG: "Etiket",
  UNASSIGNED: "Atanmamış / yeni",
};

export default function AssignmentRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [matchType, setMatchType] = useState("KEYWORD");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [rulesRes, teamRes, channelsRes, tagsRes] = await Promise.all([
      fetch("/api/assignment-rules"),
      fetch("/api/team"),
      fetch("/api/channels"),
      fetch("/api/tags"),
    ]);
    const [rulesData, teamData, channelsData, tagsData] = await Promise.all([
      rulesRes.json(),
      teamRes.json(),
      channelsRes.json(),
      tagsRes.json(),
    ]);
    setRules(rulesData.rules ?? []);
    setTeam(teamData.users ?? []);
    setChannels(channelsData.channels ?? []);
    setTags(tagsData.tags ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  function describeValue(rule: Rule) {
    if (rule.matchType === "CHANNEL") {
      if (rule.matchValue === "*") return "tüm kanallar";
      const ch = channels.find((c) => c.id === rule.matchValue);
      return ch?.name ?? rule.matchValue ?? "—";
    }
    if (rule.matchType === "TAG") {
      const tag = tags.find((t) => t.id === rule.matchValue);
      return tag?.name ?? rule.matchValue ?? "—";
    }
    return rule.matchValue ?? "—";
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    try {
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
      formEl.reset();
      setMatchType("KEYWORD");
      await load();
    } catch {
      setError("Sunucuya ulaşılamadı");
    } finally {
      setSaving(false);
    }
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
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Atama kuralları
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Gelen mesajlar (QR ve Cloud) bu kurallara göre otomatik temsilciye
          atanır. Öncelik numarası küçük olan önce çalışır. Atanmış sohbetlere
          tekrar uygulanmaz.
        </p>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-2xl border border-line bg-bg-elevated p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{rule.name}</div>
                <div className="mt-1 text-xs text-ink-muted">
                  {MATCH_LABELS[rule.matchType] ?? rule.matchType}
                  {rule.matchType !== "UNASSIGNED"
                    ? ` · ${describeValue(rule)}`
                    : ""}{" "}
                  · öncelik {rule.priority} ·{" "}
                  {rule.assignTo?.name ?? "eşit dağıtım (en az yük)"}
                  {!rule.isActive ? " · pasif" : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void toggle(rule)}
                  className="rounded-lg border border-line px-3 py-1 text-xs"
                >
                  {rule.isActive ? "Aktif" : "Pasif"}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(rule.id)}
                  className="rounded-lg border border-line px-3 py-1 text-xs text-danger"
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        ))}
        {!rules.length ? (
          <p className="text-sm text-ink-muted">Henüz kural yok.</p>
        ) : null}
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-5"
      >
        <h2 className="font-semibold">Yeni kural</h2>
        <input
          name="name"
          required
          minLength={2}
          placeholder="Kural adı"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
        />
        <select
          name="matchType"
          value={matchType}
          onChange={(e) => setMatchType(e.target.value)}
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
        >
          <option value="KEYWORD">Anahtar kelime (mesaj metninde)</option>
          <option value="CHANNEL">Kanal</option>
          <option value="TAG">Etiket</option>
          <option value="UNASSIGNED">Atanmamış / yeni sohbet</option>
        </select>

        {matchType === "KEYWORD" ? (
          <input
            name="matchValue"
            required
            placeholder="Örn. sipariş, destek, iade"
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          />
        ) : null}

        {matchType === "CHANNEL" ? (
          <select
            name="matchValue"
            required
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="*">Tüm kanallar</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}

        {matchType === "TAG" ? (
          <select
            name="matchValue"
            required
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="">Etiket seçin</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}

        {matchType === "UNASSIGNED" ? (
          <input type="hidden" name="matchValue" value="" />
        ) : null}

        <select
          name="assignToId"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
        >
          <option value="">Eşit dağıt (en az açık sohbeti olana)</option>
          {team.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <label className="block text-sm">
          <span className="mb-1 block text-ink-muted">
            Öncelik (1 = en yüksek)
          </span>
          <input
            name="priority"
            type="number"
            defaultValue={100}
            min={1}
            max={999}
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Kaydediliyor…" : "Kural ekle"}
        </button>
      </form>
    </div>
  );
}
