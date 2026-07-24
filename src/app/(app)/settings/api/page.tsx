"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);

  async function load() {
    const res = await fetch("/api/api-keys");
    const data = await res.json();
    if (res.status === 403) {
      setDenied(true);
      setError(data.error ?? "Pro paket gerekli");
      return;
    }
    setDenied(false);
    setKeys(data.keys ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setRawKey(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name") }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Oluşturulamadı");
      if (res.status === 403) setDenied(true);
      return;
    }
    setRawKey(data.rawKey);
    e.currentTarget.reset();
    void load();
  }

  async function revoke(id: string) {
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
    void load();
  }

  if (denied) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl">API</h1>
        <p className="text-sm text-ink-muted">{error}</p>
        <Link href="/settings/plan" className="inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white">
          Pro&apos;ya yükselt
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">API anahtarları</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Public API: <code className="text-brand">GET/POST /api/v1/conversations</code> — Bearer token.
        </p>
      </div>

      {rawKey ? (
        <div className="rounded-2xl border border-brand bg-brand-soft/50 p-4 text-sm">
          <div className="font-semibold">Yeni anahtar (bir kez gösterilir)</div>
          <code className="mt-2 block break-all rounded-xl bg-white p-3">{rawKey}</code>
        </div>
      ) : null}

      <div className="space-y-3">
        {keys.map((k) => (
          <div key={k.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-bg-elevated p-4">
            <div>
              <div className="font-semibold">{k.name}</div>
              <div className="text-xs text-ink-muted">
                {k.keyPrefix}… {k.revokedAt ? "· iptal" : ""}{" "}
                {k.lastUsedAt ? `· son kullanım ${new Date(k.lastUsedAt).toLocaleString("tr-TR")}` : ""}
              </div>
            </div>
            {!k.revokedAt ? (
              <button onClick={() => void revoke(k.id)} className="text-xs text-danger">
                İptal et
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-5">
        <input name="name" required placeholder="Anahtar adı (ör. Zapier)" className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm" />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
          Anahtar oluştur
        </button>
      </form>
    </div>
  );
}
