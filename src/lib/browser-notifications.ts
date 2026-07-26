/** Tarayıcı Notification API — yeni WhatsApp mesajları için. */

export type BrowserNotificationPermission =
  | NotificationPermission
  | "unsupported";

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

    return notification;
  } catch {
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
