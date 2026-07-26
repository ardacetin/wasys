"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import {
  canShowBrowserNotification,
  getActiveConversationId,
  getNotificationPermission,
  requestNotificationPermission,
  showBrowserNotification,
  type BrowserNotificationPermission,
} from "@/lib/browser-notifications";
import { cn } from "@/lib/utils";

type ConversationSnap = {
  id: string;
  unreadCount: number;
  lastMessageAt: string;
  lastMessagePreview: string | null;
  contact: { name: string | null; phone: string };
};

const POLL_MS = 6_000;

function previewText(c: ConversationSnap) {
  const raw = c.lastMessagePreview?.trim();
  if (!raw) return "Yeni mesaj";
  return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
}

function contactLabel(c: ConversationSnap) {
  return c.contact.name?.trim() || c.contact.phone;
}

export function NewMessageNotifier({
  enabled,
  variant = "sidebar",
}: {
  enabled: boolean;
  variant?: "sidebar" | "light";
}) {
  const [permission, setPermission] = useState<BrowserNotificationPermission>("default");
  const seenRef = useRef<Map<string, { unread: number; at: string }> | null>(null);
  const primedRef = useRef(false);
  const dark = variant === "sidebar";

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  const poll = useCallback(async () => {
    if (!enabled || !canShowBrowserNotification()) return;

    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list = (data.conversations ?? []) as ConversationSnap[];

      const next = new Map<string, { unread: number; at: string }>();
      for (const c of list) {
        next.set(c.id, { unread: c.unreadCount, at: c.lastMessageAt });
      }

      if (!primedRef.current || !seenRef.current) {
        seenRef.current = next;
        primedRef.current = true;
        return;
      }

      const prev = seenRef.current;
      const activeId = getActiveConversationId();
      const tabVisible = document.visibilityState === "visible";

      for (const c of list) {
        const before = prev.get(c.id);
        const unreadGrew = !before
          ? c.unreadCount > 0
          : c.unreadCount > before.unread;
        const newerInbound =
          Boolean(before) &&
          c.lastMessageAt !== before!.at &&
          c.unreadCount > 0;

        if (!unreadGrew && !newerInbound) continue;
        if (tabVisible && activeId && activeId === c.id) continue;

        showBrowserNotification({
          title: `WASYS · ${contactLabel(c)}`,
          body: previewText(c),
          tag: `wasys-conv-${c.id}`,
          conversationId: c.id,
        });
      }

      seenRef.current = next;
    } catch {
      /* ağ hatası — sessiz */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (permission !== "granted") return;
    void poll();
    const t = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(t);
  }, [enabled, poll, permission]);

  async function enable() {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      showBrowserNotification({
        title: "WASYS bildirimleri açık",
        body: "Yeni WhatsApp mesajlarında tarayıcı bildirimi alacaksınız.",
        tag: "wasys-notify-on",
      });
      primedRef.current = false;
      void poll();
    }
  }

  if (!enabled) return null;
  if (permission === "unsupported") return null;

  if (permission === "granted") {
    return (
      <div
        className={cn(
          "mt-3 flex items-center gap-2 text-[11px]",
          dark ? "text-white/45" : "mt-0 text-ink-muted",
        )}
      >
        <BellRing size={14} className="shrink-0 text-brand" />
        <span>Yeni mesaj bildirimleri açık</span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div
        className={cn(
          "mt-3 flex items-start gap-2 text-[11px]",
          dark ? "text-white/45" : "mt-0 text-ink-muted",
        )}
      >
        <BellOff size={14} className="mt-0.5 shrink-0" />
        <span>
          Bildirimler engelli. Tarayıcı site ayarlarından WASYS için izin verin.
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void enable()}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] transition",
        dark
          ? "mt-3 border border-white/15 text-white/80 hover:bg-white/5 hover:text-white"
          : "mt-0 border border-line text-ink hover:bg-bg-elevated",
      )}
    >
      <Bell size={14} className="shrink-0 text-brand" />
      <span>
        <span className="font-medium">Bildirimleri aç</span>
        <span
          className={cn(
            "mt-0.5 block",
            dark ? "text-white/45" : "text-ink-muted",
          )}
        >
          Yeni mesaj gelince tarayıcı uyarısı
        </span>
      </span>
    </button>
  );
}
