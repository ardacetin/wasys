"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import {
  canShowBrowserNotification,
  getActiveConversationId,
  getNotificationPermission,
  playMessageSound,
  requestNotificationPermission,
  showBrowserNotification,
  unlockNotificationAudio,
  type BrowserNotificationPermission,
} from "@/lib/browser-notifications";
import { cn } from "@/lib/utils";

type InboundEvent = {
  id: string;
  conversationId: string;
  body: string | null;
  type: string;
  createdAt: string;
  contactName: string | null;
  contactPhone: string;
};

const POLL_MS = 3_500;

function previewText(m: InboundEvent) {
  if (m.body?.trim()) {
    const raw = m.body.trim();
    return raw.length > 120 ? `${raw.slice(0, 117)}…` : raw;
  }
  if (m.type === "AUDIO") return "Sesli mesaj";
  if (m.type === "IMAGE") return "Görsel";
  return "Yeni mesaj";
}

function contactLabel(m: InboundEvent) {
  return m.contactName?.trim() || m.contactPhone;
}

/**
 * Tek poller — AppShell'de bir kez mount edilir.
 * İzin UI'sı NotificationPermissionControl ile ayrı yerlerde gösterilir.
 */
export function MessageNotifyEngine({ enabled }: { enabled: boolean }) {
  const cursorRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const primedRef = useRef(false);
  const [permission, setPermission] = useState<BrowserNotificationPermission>("default");

  useEffect(() => {
    setPermission(getNotificationPermission());
    const id = window.setInterval(() => {
      setPermission(getNotificationPermission());
    }, 15_000);
    return () => clearInterval(id);
  }, []);

  const poll = useCallback(async () => {
    if (!enabled) return;
    if (getNotificationPermission() !== "granted") return;

    try {
      const qs = cursorRef.current
        ? `?since=${encodeURIComponent(cursorRef.current)}`
        : "";
      const res = await fetch(`/api/inbox/events${qs}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const serverTime = String(data.serverTime ?? new Date().toISOString());
      const list = (data.messages ?? []) as InboundEvent[];

      if (!primedRef.current) {
        primedRef.current = true;
        cursorRef.current = serverTime;
        for (const m of list) seenIdsRef.current.add(m.id);
        return;
      }

      const activeId = getActiveConversationId();
      const tabHidden = document.visibilityState === "hidden";

      for (const m of list) {
        if (seenIdsRef.current.has(m.id)) continue;
        seenIdsRef.current.add(m.id);

        playMessageSound();

        const viewingThis =
          Boolean(activeId) && activeId === m.conversationId && !tabHidden;

        if (!viewingThis && canShowBrowserNotification()) {
          showBrowserNotification({
            title: `WASYS · ${contactLabel(m)}`,
            body: previewText(m),
            tag: `wasys-msg-${m.id}`,
            conversationId: m.conversationId,
          });
        }
      }

      if (list.length === 0) {
        cursorRef.current = serverTime;
      } else {
        cursorRef.current = list[list.length - 1]!.createdAt;
      }

      if (seenIdsRef.current.size > 300) {
        seenIdsRef.current = new Set([...seenIdsRef.current].slice(-150));
      }
    } catch {
      /* sessiz */
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    void poll();
    const t = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(t);
  }, [enabled, permission, poll]);

  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    const onVis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [enabled, permission, poll]);

  // İzin yeni verildiğinde diğer tab/control tetikleyebilir
  useEffect(() => {
    if (!enabled) return;
    const onGranted = () => {
      setPermission("granted");
      primedRef.current = false;
      cursorRef.current = null;
      seenIdsRef.current.clear();
      void poll();
    };
    window.addEventListener("wasys-notify-enabled", onGranted);
    return () => window.removeEventListener("wasys-notify-enabled", onGranted);
  }, [enabled, poll]);

  return null;
}

export function NotificationPermissionControl({
  enabled,
  variant = "sidebar",
}: {
  enabled: boolean;
  variant?: "sidebar" | "light";
}) {
  const [permission, setPermission] = useState<BrowserNotificationPermission>("default");
  const dark = variant === "sidebar";

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  async function enable() {
    const result = await requestNotificationPermission();
    setPermission(result);
    await unlockNotificationAudio();
    if (result === "granted") {
      playMessageSound();
      showBrowserNotification({
        title: "WASYS bildirimleri açık",
        body: "Yeni mesajlarda ses ve tarayıcı bildirimi alacaksınız.",
        tag: "wasys-notify-on",
      });
      window.dispatchEvent(new Event("wasys-notify-enabled"));
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
        <span>Bildirim + ses açık</span>
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
          Yeni mesajda ses + tarayıcı uyarısı
        </span>
      </span>
    </button>
  );
}

/** Geriye dönük isim — yalnızca izin UI (poll yok). */
export function NewMessageNotifier(props: {
  enabled: boolean;
  variant?: "sidebar" | "light";
}) {
  return <NotificationPermissionControl {...props} />;
}
