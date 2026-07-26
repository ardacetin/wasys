"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { isOrgAdmin } from "@/lib/roles";

type Tag = { id: string; name: string; color: string };
type Template = {
  id: string;
  title: string;
  body: string;
  shortcut: string | null;
};

const TAG_COLORS = [
  "#0F766E",
  "#1D4ED8",
  "#B45309",
  "#BE123C",
  "#7C3AED",
  "#0F172A",
];

export default function LibrarySettingsPage() {
  const [role, setRole] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tagError, setTagError] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = isOrgAdmin(role);

  async function load() {
    const [teamRes, tagsRes, templatesRes] = await Promise.all([
      fetch("/api/team"),
      fetch("/api/tags"),
      fetch("/api/templates"),
    ]);
    const team = await teamRes.json();
    const tagsData = await tagsRes.json();
    const templatesData = await templatesRes.json();
    setRole(team.me?.role ?? null);
    setTags(tagsData.tags ?? []);
    setTemplates(templatesData.templates ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createTag(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setTagError("");
    setBusy(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          color: data.get("color") || TAG_COLORS[0],
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTagError(json.error ?? "Etiket eklenemedi");
        return;
      }
      form.reset();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveTag(tag: Tag, patch: { name: string; color: string }) {
    setTagError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/tags/${tag.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) {
        setTagError(json.error ?? "Etiket güncellenemedi");
        return;
      }
      setEditingTagId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeTag(id: string) {
    if (!confirm("Bu etiket silinsin mi? Sohbetlerden de kalkar.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tags/${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  async function createTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canManage) return;
    setTemplateError("");
    setBusy(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.get("title"),
          body: data.get("body"),
          shortcut: data.get("shortcut") || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTemplateError(json.error ?? "Şablon eklenemedi");
        return;
      }
      form.reset();
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveTemplate(
    template: Template,
    patch: { title: string; body: string; shortcut: string },
  ) {
    setTemplateError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: patch.title,
          body: patch.body,
          shortcut: patch.shortcut || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setTemplateError(json.error ?? "Şablon güncellenemedi");
        return;
      }
      setEditingTemplateId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplate(id: string) {
    if (!confirm("Bu şablon silinsin mi?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (res.ok) await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Etiketler ve şablonlar
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Bu kayıtlar yalnızca sizin hesabınıza (kiracıya) aittir. Diğer
          müşteriler kendi etiket ve şablonlarını kullanır.
        </p>
        {!canManage && role ? (
          <p className="mt-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-sm text-warn">
            Görüntüleme modu: ekleme / düzenleme / silme için Yönetici veya Hesap
            sahibi rolü gerekir.
          </p>
        ) : null}
      </div>

      <section className="space-y-4" id="etiketler">
        <h2 className="text-lg font-semibold">Etiketler</h2>
        {canManage ? (
          <form
            onSubmit={createTag}
            className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-bg-elevated p-4"
          >
            <label className="min-w-[10rem] flex-1 text-sm">
              <span className="mb-1 block text-xs text-ink-muted">Ad</span>
              <input
                name="name"
                required
                placeholder="Örn. VIP"
                className="w-full rounded-xl border border-line bg-white px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-ink-muted">Renk</span>
              <select
                name="color"
                defaultValue={TAG_COLORS[0]}
                className="rounded-xl border border-line bg-white px-3 py-2"
              >
                {TAG_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Etiket ekle
            </button>
          </form>
        ) : null}
        {tagError ? <p className="text-sm text-danger">{tagError}</p> : null}
        <ul className="space-y-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="rounded-2xl border border-line bg-white p-4"
            >
              {editingTagId === tag.id ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    void saveTag(tag, {
                      name: String(fd.get("name") ?? ""),
                      color: String(fd.get("color") ?? tag.color),
                    });
                  }}
                >
                  <input
                    name="name"
                    required
                    defaultValue={tag.name}
                    className="min-w-[10rem] flex-1 rounded-xl border border-line px-3 py-2 text-sm"
                  />
                  <select
                    name="color"
                    defaultValue={tag.color}
                    className="rounded-xl border border-line px-3 py-2 text-sm"
                  >
                    {[tag.color, ...TAG_COLORS.filter((c) => c !== tag.color)].map(
                      (c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ),
                    )}
                  </select>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white"
                  >
                    Kaydet
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingTagId(null)}
                    className="rounded-xl border border-line px-3 py-2 text-sm"
                  >
                    Vazgeç
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="font-medium">{tag.name}</span>
                  </div>
                  {canManage ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingTagId(tag.id)}
                        className="text-ink-muted hover:text-ink"
                        title="Düzenle"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeTag(tag.id)}
                        className="text-ink-muted hover:text-danger"
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          ))}
          {!tags.length ? (
            <p className="text-sm text-ink-muted">Henüz etiket yok.</p>
          ) : null}
        </ul>
      </section>

      <section className="space-y-4" id="sablonlar">
        <div>
          <h2 className="text-lg font-semibold">Mesaj şablonları</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Gelen kutuda{" "}
            <code className="rounded bg-brand-soft px-1">/</code> ile seçilir.{" "}
            <code className="rounded bg-brand-soft px-1">{"{{ad}}"}</code> ve{" "}
            <code className="rounded bg-brand-soft px-1">{"{{telefon}}"}</code>{" "}
            otomatik dolar.
          </p>
        </div>
        {canManage ? (
          <form
            onSubmit={createTemplate}
            className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-4"
          >
            <input
              name="title"
              required
              placeholder="Başlık"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
            />
            <input
              name="shortcut"
              placeholder="Kısayol (ör. /merhaba)"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
            />
            <textarea
              name="body"
              required
              rows={3}
              placeholder="Mesaj içeriği"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Şablon ekle
            </button>
          </form>
        ) : null}
        {templateError ? (
          <p className="text-sm text-danger">{templateError}</p>
        ) : null}
        <ul className="space-y-3">
          {templates.map((t) => (
            <li key={t.id} className="rounded-2xl border border-line bg-white p-4">
              {editingTemplateId === t.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    void saveTemplate(t, {
                      title: String(fd.get("title") ?? ""),
                      body: String(fd.get("body") ?? ""),
                      shortcut: String(fd.get("shortcut") ?? ""),
                    });
                  }}
                >
                  <input
                    name="title"
                    required
                    defaultValue={t.title}
                    className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                  />
                  <input
                    name="shortcut"
                    defaultValue={t.shortcut ?? ""}
                    className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                  />
                  <textarea
                    name="body"
                    required
                    rows={3}
                    defaultValue={t.body}
                    className="w-full rounded-xl border border-line px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white"
                    >
                      Kaydet
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingTemplateId(null)}
                      className="rounded-xl border border-line px-3 py-2 text-sm"
                    >
                      Vazgeç
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold">{t.title}</div>
                    <div className="flex items-center gap-3">
                      {t.shortcut ? (
                        <code className="text-xs text-brand">{t.shortcut}</code>
                      ) : null}
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingTemplateId(t.id)}
                            className="text-ink-muted hover:text-ink"
                            title="Düzenle"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeTemplate(t.id)}
                            className="text-ink-muted hover:text-danger"
                            title="Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-muted">
                    {t.body}
                  </p>
                </>
              )}
            </li>
          ))}
          {!templates.length ? (
            <p className="text-sm text-ink-muted">Henüz şablon yok.</p>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
