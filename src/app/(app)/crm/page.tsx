"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Stage = "LEAD" | "CONTACTED" | "PROPOSAL" | "WON" | "LOST";

const STAGE_LABELS: Record<Stage, string> = {
  LEAD: "Yeni Lead",
  CONTACTED: "İletişimde",
  PROPOSAL: "Teklif",
  WON: "Kazanıldı",
  LOST: "Kaybedildi",
};

const STAGE_COLORS: Record<Stage, string> = {
  LEAD: "bg-brand/10 text-brand",
  CONTACTED: "bg-warn/10 text-warn",
  PROPOSAL: "bg-accent/10 text-accent",
  WON: "bg-ok/10 text-ok",
  LOST: "bg-danger/10 text-danger",
};

const STAGES: Stage[] = ["LEAD", "CONTACTED", "PROPOSAL", "WON", "LOST"];

type Contact = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  crmStage: Stage;
  dealValue: number | null;
  notes: string | null;
  updatedAt: string;
  _count: { conversations: number; crmNotes: number };
};

type Note = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string } | null;
};

type ContactDetail = Contact & {
  crmNotes: Note[];
  conversations: {
    id: string;
    lastMessageAt: string;
    lastMessagePreview: string | null;
    channel: { name: string };
    assignedTo: { name: string } | null;
  }[];
};

type Summary = Record<Stage, { count: number; value: number }>;

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "">("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<ContactDetail | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (stageFilter) params.set("stage", stageFilter);
    params.set("page", String(page));
    const res = await fetch(`/api/contacts?${params}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setContacts(data.contacts ?? []);
      setSummary(data.summary ?? null);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPageSize(data.pageSize ?? 20);
      if (data.page && data.page !== page) setPage(data.page);
    }
  }, [q, stageFilter, page]);

  useEffect(() => {
    setPage(1);
  }, [q, stageFilter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  async function exportExcel() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (stageFilter) params.set("stage", stageFilter);
      const res = await fetch(`/api/export/crm?${params}`, { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Excel dışa aktarılamadı");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wasys-crm-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function openDetail(id: string) {
    setDetailError("");
    const res = await fetch(`/api/contacts/${id}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setSelected(data.contact);
  }

  async function patchContact(id: string, patch: Record<string, unknown>) {
    setDetailError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error ?? "Kaydedilemedi");
        return;
      }
      setSelected((prev) => (prev ? { ...prev, ...data.contact } : prev));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function removeContact(contact: ContactDetail) {
    if (
      !window.confirm(
        `${contact.name ?? contact.phone} silinecek. Tüm sohbetleri ve mesaj geçmişi de silinir. Emin misiniz?`,
      )
    ) {
      return;
    }
    const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setDetailError(data.error ?? "Silinemedi");
      return;
    }
    setSelected(null);
    await load();
  }

  async function addNote(e: FormEvent) {
    e.preventDefault();
    if (!selected || !noteDraft.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/contacts/${selected.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteDraft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDetailError(data.error ?? "Not eklenemedi");
        return;
      }
      setSelected((prev) =>
        prev ? { ...prev, crmNotes: [data.note, ...prev.crmNotes] } : prev,
      );
      setNoteDraft("");
    } finally {
      setBusy(false);
    }
  }

  async function deleteNote(noteId: string) {
    if (!selected) return;
    const res = await fetch(
      `/api/contacts/${selected.id}/notes?noteId=${noteId}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      setSelected((prev) =>
        prev
          ? { ...prev, crmNotes: prev.crmNotes.filter((n) => n.id !== noteId) }
          : prev,
      );
    }
  }

  async function createContact(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const dealValueRaw = String(form.get("dealValue") ?? "").trim();
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        phone: form.get("phone"),
        email: form.get("email") || null,
        company: form.get("company") || null,
        crmStage: form.get("crmStage"),
        dealValue: dealValueRaw ? Number(dealValueRaw) : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Kişi eklenemedi");
      return;
    }
    formEl.reset();
    setShowCreate(false);
    await load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">CRM</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Müşteri kartları, satış aşamaları ve notlar
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting || total === 0}
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-medium text-ink disabled:opacity-50"
          >
            {exporting ? "Hazırlanıyor…" : "Excel’e aktar"}
          </button>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white"
          >
            {showCreate ? "Vazgeç" : "Yeni kişi"}
          </button>
        </div>
      </div>

      {summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => setStageFilter((cur) => (cur === s ? "" : s))}
              className={`rounded-2xl border p-3 text-left transition ${
                stageFilter === s
                  ? "border-brand bg-brand/5"
                  : "border-line bg-bg-elevated hover:border-brand/40"
              }`}
            >
              <div className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[s]}`}>
                {STAGE_LABELS[s]}
              </div>
              <div className="mt-2 text-2xl font-semibold">{summary[s].count}</div>
              {summary[s].value > 0 ? (
                <div className="text-xs text-ink-muted">{money(summary[s].value)}</div>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={createContact}
          className="grid gap-3 rounded-2xl border border-line bg-bg-elevated p-5 md:grid-cols-2"
        >
          <h2 className="font-semibold md:col-span-2">Yeni kişi</h2>
          <input name="name" required placeholder="Ad soyad" className="rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          <input name="phone" required placeholder="Telefon (905xxxxxxxxx)" className="rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          <input name="email" type="email" placeholder="E-posta (opsiyonel)" className="rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          <input name="company" placeholder="Firma (opsiyonel)" className="rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          <select name="crmStage" defaultValue="LEAD" className="rounded-xl border border-line bg-white px-3 py-2 text-sm">
            {STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
          <input name="dealValue" type="number" min="0" step="any" placeholder="Fırsat tutarı ₺ (opsiyonel)" className="rounded-xl border border-line bg-white px-3 py-2 text-sm" />
          {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
          <button type="submit" className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white md:col-span-2">
            Kaydet
          </button>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ara: ad, telefon, e-posta, firma"
          className="w-full max-w-sm rounded-xl border border-line bg-white px-3 py-2 text-sm"
        />
        {stageFilter ? (
          <button
            onClick={() => setStageFilter("")}
            className="rounded-xl border border-line px-3 py-2 text-sm text-ink-muted hover:bg-white"
          >
            Filtreyi kaldır: {STAGE_LABELS[stageFilter]} ✕
          </button>
        ) : null}
      </div>

      <div className="flex gap-6">
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-line bg-bg-elevated">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-white/50 text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3">Kişi</th>
                <th className="hidden px-4 py-3 md:table-cell">Firma</th>
                <th className="px-4 py-3">Aşama</th>
                <th className="hidden px-4 py-3 md:table-cell">Fırsat</th>
                <th className="hidden px-4 py-3 md:table-cell">Sohbet</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => void openDetail(c.id)}
                  className={`cursor-pointer border-b border-line last:border-0 hover:bg-white/60 ${
                    selected?.id === c.id ? "bg-brand/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name ?? c.phone}</div>
                    <div className="text-xs text-ink-muted">{c.phone}</div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink-muted md:table-cell">
                    {c.company ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_COLORS[c.crmStage]}`}>
                      {STAGE_LABELS[c.crmStage]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {c.dealValue ? money(c.dealValue) : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-ink-muted md:table-cell">
                    {c._count.conversations}
                  </td>
                </tr>
              ))}
              {!contacts.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                    Kayıt bulunamadı. WhatsApp&apos;tan yazan kişiler otomatik eklenir,
                    &quot;Yeni kişi&quot; ile manuel de ekleyebilirsiniz.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {total > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
              <span className="text-ink-muted">
                {total} kayıt · sayfa {page} / {totalPages}
                {pageSize ? ` · ${pageSize}/sayfa` : null}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-xl border border-line px-3 py-1.5 disabled:opacity-40"
                >
                  Önceki
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-xl border border-line px-3 py-1.5 disabled:opacity-40"
                >
                  Sonraki
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {selected ? (
          <aside className="w-96 shrink-0 space-y-4 rounded-2xl border border-line bg-bg-elevated p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selected.name ?? selected.phone}</h2>
                <p className="text-sm text-ink-muted">{selected.phone}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg px-2 py-1 text-ink-muted hover:bg-white"
                aria-label="Kapat"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">Aşama</span>
                <select
                  value={selected.crmStage}
                  disabled={busy}
                  onChange={(e) => void patchContact(selected.id, { crmStage: e.target.value })}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">Firma</span>
                <input
                  defaultValue={selected.company ?? ""}
                  disabled={busy}
                  onBlur={(e) => {
                    if (e.target.value !== (selected.company ?? "")) {
                      void patchContact(selected.id, { company: e.target.value || null });
                    }
                  }}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">E-posta</span>
                <input
                  type="email"
                  defaultValue={selected.email ?? ""}
                  disabled={busy}
                  onBlur={(e) => {
                    if (e.target.value !== (selected.email ?? "")) {
                      void patchContact(selected.id, { email: e.target.value || null });
                    }
                  }}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink-muted">Fırsat tutarı (₺)</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  defaultValue={selected.dealValue ?? ""}
                  disabled={busy}
                  onBlur={(e) => {
                    const v = e.target.value.trim() ? Number(e.target.value) : null;
                    if (v !== selected.dealValue) {
                      void patchContact(selected.id, { dealValue: v });
                    }
                  }}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2"
                />
              </label>
            </div>

            {selected.conversations.length ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Sohbetler
                </h3>
                <ul className="space-y-1">
                  {selected.conversations.slice(0, 5).map((conv) => (
                    <li key={conv.id}>
                      <Link
                        href={`/inbox?conversation=${conv.id}`}
                        className="block rounded-xl border border-line bg-white px-3 py-2 text-xs hover:border-brand/40"
                      >
                        <span className="font-medium">{conv.channel.name}</span>
                        {conv.assignedTo ? (
                          <span className="text-ink-muted"> · {conv.assignedTo.name}</span>
                        ) : null}
                        <span className="mt-0.5 block truncate text-ink-muted">
                          {conv.lastMessagePreview ?? "—"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Notlar ({selected.crmNotes.length})
              </h3>
              <form onSubmit={addNote} className="mb-3 flex gap-2">
                <input
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Not ekle…"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={busy || !noteDraft.trim()}
                  className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Ekle
                </button>
              </form>
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {selected.crmNotes.map((note) => (
                  <li key={note.id} className="group rounded-xl border border-line bg-white p-3 text-sm">
                    <p className="whitespace-pre-wrap">{note.body}</p>
                    <div className="mt-1 flex items-center justify-between text-xs text-ink-muted">
                      <span>
                        {note.author?.name ?? "—"} ·{" "}
                        {new Date(note.createdAt).toLocaleString("tr-TR")}
                      </span>
                      <button
                        onClick={() => void deleteNote(note.id)}
                        className="opacity-0 transition group-hover:opacity-100 hover:text-danger"
                      >
                        Sil
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {detailError ? <p className="text-sm text-danger">{detailError}</p> : null}

            <button
              onClick={() => void removeContact(selected)}
              className="w-full rounded-xl border border-danger/30 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/5"
            >
              Kişiyi sil
            </button>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
