/** Tarayıcı Notification API + yeni mesaj sesi. */

export type BrowserNotificationPermission =
  | NotificationPermission
  | "unsupported";

let audioCtx: AudioContext | null = null;

export function getNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<BrowserNotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function canShowBrowserNotification() {
  return getNotificationPermission() === "granted";
}

/** Kullanıcı jesti (Bildirimleri aç) sonrası AudioContext’i aç. */
export async function unlockNotificationAudio() {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
  } catch {
    /* ignore */
  }
}

/** Kısa “yeni mesaj” bip sesi — harici dosya gerekmez. */
export function playMessageSound() {
  if (typeof window === "undefined") return;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audioCtx ??= new Ctx();
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }

    const t0 = audioCtx.currentTime;
    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.18, t0);
    master.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
    master.connect(audioCtx.destination);

    const ding = (freq: number, start: number, dur: number) => {
      const osc = audioCtx!.createOscillator();
      const g = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0 + start);
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(1, t0 + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    };

    ding(880, 0, 0.14);
    ding(1175, 0.1, 0.18);
  } catch {
    /* ignore */
  }
}

export function showBrowserNotification(options: {
  title: string;
  body: string;
  tag?: string;
  conversationId?: string;
}) {
  if (!canShowBrowserNotification()) return null;

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      tag: options.tag ?? options.conversationId ?? "wasys-message",
      requireInteraction: false,
      silent: true, // kendi sesimizi çalıyoruz
    });

    notification.onclick = () => {
      try {
        window.focus();
        const id = options.conversationId;
        if (id) {
          window.location.href = `/inbox?conversation=${encodeURIComponent(id)}`;
        } else {
          window.location.href = "/inbox";
        }
      } catch {
        /* ignore */
      }
      notification.close();
    };

    // Bir süre sonra kapat (masaüstünde birikmesin)
    window.setTimeout(() => {
      try {
        notification.close();
      } catch {
        /* ignore */
      }
    }, 12_000);

    return notification;
  } catch (error) {
    console.warn("[WASYS] Notification gösterilemedi", error);
    return null;
  }
}

declare global {
  interface Window {
    __wasysActiveConversationId?: string | null;
  }
}

export function setActiveConversationId(id: string | null) {
  if (typeof window === "undefined") return;
  window.__wasysActiveConversationId = id;
}

export function getActiveConversationId() {
  if (typeof window === "undefined") return null;
  return window.__wasysActiveConversationId ?? null;
}
