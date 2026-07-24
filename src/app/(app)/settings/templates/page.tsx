"use client";

import { FormEvent, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

type Template = {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    setSaving(true);
    setError("");
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        body: form.get("body"),
        shortcut: form.get("shortcut") || undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      formEl.reset();
      void load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Şablon eklenemedi");
    }
  }

  async function remove(id: string) {
    if (!confirm("Bu şablon silinsin mi?")) return;
    const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Hazır mesaj şablonları</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sık kullanılan yanıtları gelen kutusundan tek tıkla veya{" "}
          <code className="rounded bg-brand-soft px-1">/</code> yazarak otomatik
          öneriden seçin.{" "}
          <code className="rounded bg-brand-soft px-1">{"{{ad}}"}</code> ve{" "}
          <code className="rounded bg-brand-soft px-1">{"{{telefon}}"}</code>{" "}
          yazarsanız gönderirken kişinin adı ve telefonu otomatik yerleştirilir.
        </p>
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
          placeholder="Kısayol (ör. /merhaba — gelen kutuda / yazınca öneri çıkar)"
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
        />
        <textarea
          name="body"
          required
          rows={4}
          placeholder={"Mesaj içeriği. Örn: Merhaba {{ad}}, size nasıl yardımcı olabiliriz?"}
          className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-brand focus:ring-2"
        />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Ekleniyor…" : "Şablon ekle"}
        </button>
      </form>

      <div className="space-y-3">
        {templates.length === 0 ? (
          <p className="text-sm text-ink-muted">Henüz şablon yok. Yukarıdan ilk şablonunuzu ekleyin.</p>
        ) : null}
        {templates.map((t) => (
          <div key={t.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-semibold">{t.title}</div>
              <div className="flex items-center gap-3">
                {t.shortcut ? <code className="text-xs text-brand">{t.shortcut}</code> : null}
                <button
                  onClick={() => void remove(t.id)}
                  title="Şablonu sil"
                  className="text-ink-muted transition hover:text-danger"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">{t.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
