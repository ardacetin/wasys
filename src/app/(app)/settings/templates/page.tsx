"use client";

import { FormEvent, useEffect, useState } from "react";

type Template = {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);

  async function load() {
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.templates ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        body: form.get("body"),
        shortcut: form.get("shortcut") || undefined,
      }),
    });
    if (res.ok) {
      e.currentTarget.reset();
      void load();
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Hazır mesaj şablonları</h1>
        <p className="mt-1 text-sm text-ink-muted">Sık kullanılan yanıtları tek tıkla gönderin.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-5">
        <input
          name="title"
          required
          placeholder="Başlık"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
        />
        <input
          name="shortcut"
          placeholder="Kısayol (ör. /merhaba)"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
        />
        <textarea
          name="body"
          required
          rows={4}
          placeholder="Mesaj içeriği"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
        />
        <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">
          Şablon ekle
        </button>
      </form>

      <div className="space-y-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{t.title}</div>
              {t.shortcut ? <code className="text-xs text-brand">{t.shortcut}</code> : null}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
