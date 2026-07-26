"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Check, CheckCheck, Filter, LayoutTemplate, Mic, Search, Send, X } from "lucide-react";
import {
  filterTemplatesBySlashQuery,
  findExactShortcutTemplate,
} from "@/lib/template-shortcuts";
import { setActiveConversationId } from "@/lib/browser-notifications";
import { cn, initials } from "@/lib/utils";

function fillTemplate(
  body: string,
  contact: { name: string | null; phone: string } | undefined,
) {
  if (!contact) return body;
  const name = contact.name?.trim() || contact.phone;
  return body
    .replace(/\{\{\s*(ad|isim|name)\s*\}\}/gi, name)
    .replace(/\{\{\s*(telefon|phone)\s*\}\}/gi, contact.phone);
}

type Tag = { id: string; name: string; color: string };
type Conversation = {
  id: string;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  unreadCount: number;
  contact: { id: string; name: string | null; phone: string; email: string | null };
  assignedTo: { id: string; name: string } | null;
  tags: { tag: Tag }[];
  channel: { id: string; name: string; type: string; status: string };
};

type Message = {
  id: string;
  direction: "INBOUND" | "OUTBOUND";
  type: string;
  status: string;
  body: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

type Template = { id: string; title: string; body: string; shortcut: string | null };
type QuickButton = { id: string; label: string; body: string };
type TeamUser = { id: string; name: string };

function StatusTicks({ status }: { status: string }) {
  if (status === "READ") return <CheckCheck size={14} className="text-sky-500" />;
  if (status === "DELIVERED" || status === "SENT") return <CheckCheck size={14} className="text-ink-muted" />;
  if (status === "FAILED") return <span className="text-[10px] text-danger">hata</span>;
  return <Check size={14} className="text-ink-muted" />;
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    // CRM ve diğer sayfalardan ?conversation=<id> ile doğrudan sohbet açma
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("conversation");
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [buttons, setButtons] = useState<QuickButton[]>([]);
  const [team, setTeam] = useState<TeamUser[]>([]);
  const [q, setQ] = useState("");
  const [tagId, setTagId] = useState("");
  const [assigned, setAssigned] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [shortcutHighlight, setShortcutHighlight] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const slashSuggestions = useMemo(
    () => filterTemplatesBySlashQuery(templates, draft),
    [templates, draft],
  );
  const showSlashSuggest =
    !templatesOpen && draft.trim().startsWith("/") && slashSuggestions.length > 0;

  const loadConversations = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tagId) params.set("tagId", tagId);
    if (assigned) params.set("assigned", assigned);
    const res = await fetch(`/api/conversations?${params}`);
    const data = await res.json();
    setConversations(data.conversations ?? []);
  }, [q, tagId, assigned]);

  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`);
    const data = await res.json();
    if (!data.conversation) return;
    setSelected(data.conversation);
    setMessages(data.conversation.messages ?? []);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );
  }, []);

  useEffect(() => {
    void Promise.all([
      fetch("/api/tags").then((r) => r.json()),
      fetch("/api/templates").then((r) => r.json()),
      fetch("/api/quick-buttons").then((r) => r.json()),
      fetch("/api/team").then((r) => r.json()),
    ]).then(([tagsData, templatesData, buttonsData, teamData]) => {
      setTags(tagsData.tags ?? []);
      setTemplates(templatesData.templates ?? []);
      setButtons(buttonsData.buttons ?? []);
      setTeam(teamData.users ?? []);
    });
  }, []);

  useEffect(() => {
    void loadConversations();
    const t = setInterval(() => void loadConversations(), 8000);
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    void loadConversation(selectedId);
    const t = setInterval(() => void loadConversation(selectedId), 4000);
    return () => clearInterval(t);
  }, [selectedId, loadConversation]);

  // Bildirim sistemi: açık sohbete bakarken aynı konuşma için spam atmasın
  useEffect(() => {
    setActiveConversationId(selectedId);
    return () => setActiveConversationId(null);
  }, [selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const filteredHint = useMemo(() => {
    if (!conversations.length) return "Sohbet bulunamadı";
    return `${conversations.length} sohbet`;
  }, [conversations.length]);

  async function sendMessage(body: string, type: "TEXT" | "AUDIO" = "TEXT", mediaUrl?: string) {
    if (!selectedId || !body.trim()) return;
    setSending(true);
    const res = await fetch(`/api/conversations/${selectedId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, type, mediaUrl }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (data.message) {
      setMessages((prev) => [...prev, data.message]);
      if (data.message.status !== "FAILED") {
        setDraft("");
      }
      void loadConversations();
    }
    if (data.error || data.message?.status === "FAILED") {
      alert(data.error || "Mesaj WhatsApp’a iletilemedi. Kanal bağlantısını kontrol edin.");
    }
  }

  useEffect(() => {
    setShortcutHighlight(0);
  }, [draft, showSlashSuggest]);

  function insertTemplate(t: Template) {
    setDraft(fillTemplate(t.body, selected?.contact));
    setTemplatesOpen(false);
  }

  function sendTemplate(t: Template) {
    setTemplatesOpen(false);
    void sendMessage(fillTemplate(t.body, selected?.contact));
  }

  /** Tam kısayol (ör. /merhaba) → şablon metnini taslağa yazar. */
  function expandShortcut(): boolean {
    const t = findExactShortcutTemplate(templates, draft);
    if (!t) return false;
    setDraft(fillTemplate(t.body, selected?.contact));
    return true;
  }

  async function assignTo(userId: string) {
    if (!selectedId) return;
    await fetch(`/api/conversations/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: userId || null }),
    });
    void loadConversation(selectedId);
    void loadConversations();
  }

  async function toggleTag(tag: Tag) {
    if (!selected) return;
    const current = selected.tags.map((t) => t.tag.id);
    const next = current.includes(tag.id)
      ? current.filter((id) => id !== tag.id)
      : [...current, tag.id];
    await fetch(`/api/conversations/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagIds: next }),
    });
    void loadConversation(selected.id);
    void loadConversations();
  }

  return (
    <div className="grid h-[calc(100vh-0px)] md:h-screen md:grid-cols-[320px_1fr_280px]">
      <section className="flex min-h-0 flex-col border-r border-line bg-bg-elevated/70">
        <div className="border-b border-line p-4">
          <h1 className="font-[family-name:var(--font-display)] text-2xl">Gelen kutusu</h1>
          <p className="mt-1 text-xs text-ink-muted">{filteredHint}</p>
          <div className="relative mt-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ara..."
              className="w-full rounded-xl border border-line bg-white py-2 pl-9 pr-3 text-sm outline-none ring-brand focus:ring-2"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs"
            >
              <option value="">Tüm etiketler</option>
              {tags.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              value={assigned}
              onChange={(e) => setAssigned(e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-1.5 text-xs"
            >
              <option value="">Herkes</option>
              <option value="me">Bana atanan</option>
              <option value="unassigned">Atanmamış</option>
            </select>
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
              <Filter size={12} /> filtre
            </span>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={cn(
                "flex w-full gap-3 border-b border-line px-4 py-3 text-left transition hover:bg-brand-soft/40",
                selectedId === c.id && "bg-brand-soft/60",
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-panel text-sm font-semibold text-panel-ink">
                {initials(c.contact.name ?? c.contact.phone)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-semibold">{c.contact.name ?? c.contact.phone}</div>
                  <div className="shrink-0 text-[11px] text-ink-muted">
                    {formatDistanceToNow(new Date(c.lastMessageAt), { addSuffix: true, locale: tr })}
                  </div>
                </div>
                <div className="mt-0.5 truncate text-sm text-ink-muted">{c.lastMessagePreview}</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {c.tags.map(({ tag }) => (
                    <span
                      key={tag.id}
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                      style={{ background: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {c.unreadCount > 0 ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                      {c.unreadCount}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="flex min-h-0 min-w-0 flex-col bg-bg/40">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-ink-muted">
            <div>
              <div className="font-[family-name:var(--font-display)] text-3xl text-ink">WASYS</div>
              <p className="mt-2 text-sm">Soldan bir sohbet seçin veya QR ile WhatsApp bağlayın.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-line bg-bg-elevated/80 px-5 py-3">
              <div>
                <div className="font-semibold">{selected.contact.name ?? selected.contact.phone}</div>
                <div className="text-xs text-ink-muted">
                  {selected.contact.phone} · {selected.channel.name}
                </div>
              </div>
              <div className="text-xs text-ink-muted">
                {selected.assignedTo ? `Atanan: ${selected.assignedTo.name}` : "Atanmamış"}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.direction === "OUTBOUND" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm",
                      m.direction === "OUTBOUND"
                        ? "rounded-br-md bg-brand text-white"
                        : "rounded-bl-md border border-line bg-bg-elevated",
                    )}
                  >
                    {m.type === "AUDIO" && m.mediaUrl ? (
                      <audio controls src={m.mediaUrl} className="mb-1 max-w-full" />
                    ) : null}
                    <div className="whitespace-pre-wrap">{m.body}</div>
                    <div
                      className={cn(
                        "mt-1 flex items-center justify-end gap-1 text-[10px]",
                        m.direction === "OUTBOUND" ? "text-white/75" : "text-ink-muted",
                      )}
                    >
                      {new Date(m.createdAt).toLocaleTimeString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {m.direction === "OUTBOUND" ? <StatusTicks status={m.status} /> : null}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="relative border-t border-line bg-bg-elevated/90 p-3">
              {templatesOpen ? (
                <div className="absolute bottom-full left-3 right-3 z-10 mb-2 max-h-80 overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-lg">
                  <div className="flex items-center justify-between px-2 py-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                      Hazır şablonlar
                    </span>
                    <button onClick={() => setTemplatesOpen(false)} className="text-ink-muted hover:text-ink">
                      <X size={14} />
                    </button>
                  </div>
                  {templates.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-ink-muted">
                      Henüz şablon yok. Ayarlar → Şablonlar bölümünden ekleyin.
                    </p>
                  ) : (
                    templates.map((t) => (
                      <div
                        key={t.id}
                        className="group flex items-start justify-between gap-2 rounded-xl px-2 py-2 hover:bg-brand-soft/50"
                      >
                        <button onClick={() => insertTemplate(t)} className="min-w-0 flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold">{t.title}</span>
                            {t.shortcut ? (
                              <code className="shrink-0 text-[10px] text-brand">{t.shortcut}</code>
                            ) : null}
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                            {fillTemplate(t.body, selected?.contact)}
                          </p>
                        </button>
                        <button
                          onClick={() => sendTemplate(t)}
                          disabled={sending}
                          className="shrink-0 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-white opacity-90 hover:bg-brand-deep disabled:opacity-50"
                          title="Şablonu hemen gönder"
                        >
                          Gönder
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : null}

              {showSlashSuggest ? (
                <div
                  role="listbox"
                  aria-label="Şablon önerileri"
                  className="absolute bottom-full left-3 right-3 z-10 mb-2 max-h-64 overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-lg"
                >
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    Şablon önerileri · Enter veya tıkla
                  </p>
                  {slashSuggestions.map((t, i) => (
                    <button
                      key={t.id}
                      type="button"
                      role="option"
                      aria-selected={i === shortcutHighlight}
                      onMouseEnter={() => setShortcutHighlight(i)}
                      onClick={() => insertTemplate(t)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-xl px-2 py-2 text-left",
                        i === shortcutHighlight ? "bg-brand-soft" : "hover:bg-brand-soft/50",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{t.title}</span>
                          {t.shortcut ? (
                            <code className="shrink-0 text-[10px] text-brand">{t.shortcut}</code>
                          ) : null}
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-xs text-ink-muted">
                          {fillTemplate(t.body, selected?.contact)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mb-2 flex flex-wrap gap-2">
                <button
                  onClick={() => setTemplatesOpen((v) => !v)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs font-medium",
                    templatesOpen ? "bg-brand text-white" : "bg-white hover:bg-brand-soft",
                  )}
                >
                  <LayoutTemplate size={13} />
                  Şablonlar
                </button>
                {buttons.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setDraft(fillTemplate(b.body, selected?.contact))}
                    className="rounded-full border border-line bg-white px-3 py-1 text-xs hover:bg-brand-soft"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={2}
                  placeholder="Mesaj yazın… / yazınca şablonlar otomatik çıkar"
                  className="min-h-[48px] flex-1 resize-none rounded-2xl border border-line bg-white px-3 py-2.5 text-sm outline-none ring-brand focus:ring-2"
                  onKeyDown={(e) => {
                    if (showSlashSuggest) {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setShortcutHighlight((h) =>
                          Math.min(h + 1, slashSuggestions.length - 1),
                        );
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setShortcutHighlight((h) => Math.max(h - 1, 0));
                        return;
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setDraft("");
                        return;
                      }
                      if (e.key === "Tab") {
                        e.preventDefault();
                        const pick =
                          slashSuggestions[shortcutHighlight] ?? slashSuggestions[0];
                        if (pick) insertTemplate(pick);
                        return;
                      }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        const exact = findExactShortcutTemplate(templates, draft);
                        if (exact) {
                          setDraft(fillTemplate(exact.body, selected?.contact));
                          return;
                        }
                        const pick =
                          slashSuggestions[shortcutHighlight] ?? slashSuggestions[0];
                        if (pick) insertTemplate(pick);
                        return;
                      }
                    }
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (expandShortcut()) return;
                      void sendMessage(draft);
                    }
                  }}
                />
                <button
                  title="Sesli mesaj (yakında dosya yükleme)"
                  className="rounded-xl border border-line bg-white p-3 text-ink-muted"
                  type="button"
                >
                  <Mic size={18} />
                </button>
                <button
                  disabled={sending || !draft.trim()}
                  onClick={() => void sendMessage(draft)}
                  className="rounded-xl bg-brand p-3 text-white hover:bg-brand-deep disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <aside className="hidden min-h-0 flex-col border-l border-line bg-bg-elevated/70 lg:flex">
        <div className="border-b border-line p-4">
          <h2 className="font-[family-name:var(--font-display)] text-lg">Detay</h2>
        </div>
        {selected ? (
          <div className="space-y-5 overflow-y-auto p-4 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wide text-ink-muted">Kişi</div>
              <div className="mt-1 font-semibold">{selected.contact.name ?? "—"}</div>
              <div className="text-ink-muted">{selected.contact.phone}</div>
              {selected.contact.email ? (
                <div className="text-ink-muted">{selected.contact.email}</div>
              ) : null}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-ink-muted">Atama</div>
              <select
                className="mt-2 w-full rounded-xl border border-line bg-white px-3 py-2"
                value={selected.assignedTo?.id ?? ""}
                onChange={(e) => void assignTo(e.target.value)}
              >
                <option value="">Atanmamış</option>
                {team.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-ink-muted">Etiketler</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active = selected.tags.some((t) => t.tag.id === tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => void toggleTag(tag)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-medium",
                        active ? "text-white" : "border border-line bg-white",
                      )}
                      style={active ? { background: tag.color } : undefined}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-sm text-ink-muted">Sohbet seçilmedi</div>
        )}
      </aside>
    </div>
  );
}
