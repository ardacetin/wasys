"use client";

import { useEffect, useMemo, useState } from "react";

type Channel = {
  id: string;
  name: string;
  type: string;
  status: string;
  phoneNumber: string | null;
  qrData: string | null;
  lastError: string | null;
};

type MetaConfig = {
  configured: boolean;
  appId: string | null;
  configId: string | null;
  canManage: boolean;
  oauthStartUrl: string;
};

type MetaPhoneOption = {
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string;
  verifiedName: string;
};

const STATUS_LABELS: Record<string, string> = {
  CONNECTING: "Bağlanıyor…",
  QR_PENDING: "QR bekleniyor",
  CONNECTED: "Bağlı",
  DISCONNECTED: "Bağlı değil",
  ERROR: "Hata",
};

declare global {
  interface Window {
    FB?: {
      init: (opts: Record<string, unknown>) => void;
      login: (
        cb: (response: {
          authResponse?: { code?: string };
          status?: string;
        }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

function decodePickPhones(pickToken: string): MetaPhoneOption[] {
  try {
    const body = pickToken.split(".")[0];
    if (!body) return [];
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = JSON.parse(atob(b64 + pad));
    return (json.phones ?? []) as MetaPhoneOption[];
  } catch {
    return [];
  }
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [meta, setMeta] = useState<MetaConfig | null>(null);
  const [metaBusy, setMetaBusy] = useState(false);
  const [metaMessage, setMetaMessage] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [pickToken, setPickToken] = useState<string | null>(null);
  const [sdkReady, setSdkReady] = useState(false);

  const qrChannels = channels.filter((c) => c.type === "WHATSAPP_QR");
  const canAddQr = qrChannels.length === 0;
  const pickPhones = useMemo(
    () => (pickToken ? decodePickPhones(pickToken) : []),
    [pickToken],
  );

  async function load() {
    const res = await fetch("/api/channels");
    const data = await res.json();
    setChannels(data.channels ?? []);
  }

  async function loadMeta() {
    const res = await fetch("/api/meta/cloud-connect");
    const data = await res.json();
    setMeta(data);
  }

  useEffect(() => {
    void load();
    void loadMeta();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ok = params.get("meta_ok");
    const err = params.get("meta_error");
    const pick = params.get("meta_pick");
    if (ok) {
      setMetaMessage("WhatsApp Cloud Facebook ile bağlandı.");
      void load();
    }
    if (err) setMetaError(err);
    if (pick) setPickToken(pick);
    if (ok || err || pick) {
      window.history.replaceState({}, "", "/settings/channels");
    }
  }, []);

  useEffect(() => {
    const pending = channels.filter(
      (c) =>
        c.type === "WHATSAPP_QR" &&
        ["CONNECTING", "QR_PENDING"].includes(c.status),
    );
    if (!pending.length) return;
    const t = setInterval(async () => {
      for (const c of pending) {
        const res = await fetch(`/api/channels/${c.id}/connect`);
        const data = await res.json();
        if (data.channel) {
          setChannels((prev) =>
            prev.map((x) => (x.id === c.id ? data.channel : x)),
          );
        }
      }
    }, 2500);
    return () => clearInterval(t);
  }, [channels]);

  // Embedded Signup SDK
  useEffect(() => {
    if (!meta?.configured || !meta.appId || !meta.configId) return;

    window.fbAsyncInit = () => {
      window.FB?.init({
        appId: meta.appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v21.0",
      });
      setSdkReady(true);
    };

    if (document.getElementById("facebook-jssdk")) {
      if (window.FB) {
        window.FB.init({
          appId: meta.appId,
          autoLogAppEvents: true,
          xfbml: true,
          version: "v21.0",
        });
        setSdkReady(true);
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    document.body.appendChild(script);
  }, [meta?.configured, meta?.appId, meta?.configId]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (typeof event.origin !== "string" || !event.origin.endsWith("facebook.com")) {
        return;
      }
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type === "WA_EMBEDDED_SIGNUP") {
          (window as unknown as { __wasysEsSession?: unknown }).__wasysEsSession =
            data.data;
        }
      } catch {
        /* ignore */
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function connectQr(id: string) {
    setLoadingId(id);
    const res = await fetch(`/api/channels/${id}/connect`, { method: "POST" });
    const data = await res.json();
    setLoadingId(null);
    if (data.error) {
      alert(data.error);
      return;
    }
    if (data.channel) {
      setChannels((prev) => prev.map((c) => (c.id === id ? data.channel : c)));
    }
    void load();
  }

  async function disconnectQr(id: string) {
    if (
      !confirm(
        "WhatsApp bağlantısı kesilsin mi? Yeniden bağlanmak için tekrar QR taramanız gerekir.",
      )
    ) {
      return;
    }
    setLoadingId(id);
    const res = await fetch(`/api/channels/${id}/connect`, { method: "DELETE" });
    const data = await res.json();
    setLoadingId(null);
    if (data.channel) {
      setChannels((prev) => prev.map((c) => (c.id === id ? data.channel : c)));
    }
  }

  async function addQrChannel() {
    if (!canAddQr) {
      alert(
        "Bu hesapta zaten bir WhatsApp QR kanalı var. Şimdilik tek numara bağlanabilir.",
      );
      return;
    }
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "WHATSAPP_QR", name: "WhatsApp QR" }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "QR kanalı eklenemedi");
      void load();
      return;
    }
    if (data.channel) setChannels((prev) => [...prev, data.channel]);
  }

  async function finishEmbedded(code: string) {
    const session = (window as unknown as { __wasysEsSession?: {
      phone_number_id?: string;
      waba_id?: string;
    } }).__wasysEsSession;

    if (!session?.phone_number_id || !session?.waba_id) {
      setMetaError(
        "Facebook akışı tamamlandı ama numara bilgisi gelmedi. OAuth ile deneyin.",
      );
      return;
    }

    setMetaBusy(true);
    setMetaError(null);
    try {
      const res = await fetch("/api/meta/cloud-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          phoneNumberId: session.phone_number_id,
          wabaId: session.waba_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMetaError(data.error ?? "Cloud bağlanamadı");
        return;
      }
      setMetaMessage("WhatsApp Cloud Facebook ile bağlandı.");
      void load();
    } finally {
      setMetaBusy(false);
    }
  }

  function launchEmbeddedSignup() {
    if (!window.FB || !meta?.configId) {
      window.location.href = "/api/meta/oauth/start";
      return;
    }
    setMetaBusy(true);
    setMetaError(null);
    window.FB.login(
      (response) => {
        setMetaBusy(false);
        const code = response.authResponse?.code;
        if (!code) {
          setMetaError("Facebook girişi iptal edildi veya başarısız.");
          return;
        }
        void finishEmbedded(code);
      },
      {
        config_id: meta.configId,
        response_type: "code",
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: "",
          sessionInfoVersion: "3",
        },
      },
    );
  }

  async function pickPhone(phoneNumberId: string) {
    if (!pickToken) return;
    setMetaBusy(true);
    setMetaError(null);
    try {
      const res = await fetch("/api/meta/cloud-connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "pick",
          pickToken,
          phoneNumberId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMetaError(data.error ?? "Numara seçilemedi");
        return;
      }
      setPickToken(null);
      setMetaMessage("WhatsApp Cloud numarası bağlandı.");
      void load();
    } finally {
      setMetaBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Kanallar</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Öncelikli bağlantı: WhatsApp QR (hesap başına tek numara). Cloud API için
          Facebook ile tek tıkla bağlanın.
        </p>
      </div>

      <div className="space-y-4">
        {channels.map((channel) => (
          <div
            key={channel.id}
            className="rounded-2xl border border-line bg-bg-elevated p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{channel.name}</div>
                <div className="mt-1 text-xs text-ink-muted">
                  {channel.type === "WHATSAPP_QR"
                    ? "WhatsApp QR"
                    : "WhatsApp Cloud API"}{" "}
                  · {STATUS_LABELS[channel.status] ?? channel.status}
                  {channel.phoneNumber ? ` · ${channel.phoneNumber}` : ""}
                </div>
                {channel.lastError ? (
                  <p className="mt-2 text-sm text-danger">{channel.lastError}</p>
                ) : null}
              </div>
              {channel.type === "WHATSAPP_QR" ? (
                channel.status === "CONNECTED" ? (
                  <button
                    onClick={() => void disconnectQr(channel.id)}
                    disabled={loadingId === channel.id}
                    className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-danger hover:bg-red-50 disabled:opacity-60"
                  >
                    Bağlantıyı kes
                  </button>
                ) : (
                  <button
                    onClick={() => void connectQr(channel.id)}
                    disabled={loadingId === channel.id}
                    className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
                  >
                    {loadingId === channel.id ? "Bağlanıyor..." : "QR ile bağlan"}
                  </button>
                )
              ) : (
                <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-deep">
                  Webhook: /api/webhooks/meta
                </span>
              )}
            </div>

            {channel.qrData && channel.status !== "CONNECTED" ? (
              <div className="mt-5 flex flex-col items-center gap-4 rounded-xl border border-dashed border-line bg-white p-6 md:flex-row md:items-start md:justify-center md:gap-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={channel.qrData}
                  alt="WhatsApp QR"
                  className="h-56 w-56 shrink-0"
                />
                <ol className="max-w-xs list-decimal space-y-2 pl-5 text-sm text-ink-muted md:pt-4">
                  <li>
                    Telefonunuzda <strong>WhatsApp</strong>’ı açın
                  </li>
                  <li>
                    <strong>Ayarlar → Bağlı Cihazlar</strong>’a gidin
                  </li>
                  <li>
                    <strong>Cihaz Bağla</strong>’ya dokunun
                  </li>
                  <li>Telefonunuzu bu ekrana doğrultup kodu tarayın</li>
                </ol>
              </div>
            ) : null}

            {channel.type === "WHATSAPP_QR" &&
            channel.status === "CONNECTING" &&
            !channel.qrData ? (
              <div className="mt-5 flex flex-col items-center gap-2 rounded-xl border border-dashed border-line bg-white p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                <p className="text-sm text-ink-muted">QR kod hazırlanıyor…</p>
              </div>
            ) : null}

            {channel.status === "CONNECTED" ? (
              <p className="mt-4 text-sm text-ok">
                Bağlantı aktif. Mesajlar gelen kutusuna düşecek.
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canAddQr ? (
          <button
            onClick={() => void addQrChannel()}
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold hover:bg-brand-soft"
          >
            + QR kanalı ekle
          </button>
        ) : (
          <p className="text-sm text-ink-muted">
            WhatsApp QR limiti: bu hesapta tek numara.
          </p>
        )}
      </div>

      <section className="rounded-2xl border border-line bg-bg-elevated p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl">
          WhatsApp Cloud API
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Access token veya Phone Number ID girmenize gerek yok. Facebook’a giriş
          yapın; WASYS WABA ve numarayı otomatik çeker, webhook’a abone eder.
        </p>

        {metaError ? (
          <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {metaError}
          </p>
        ) : null}
        {metaMessage ? (
          <p className="mt-3 rounded-xl bg-ok/10 px-3 py-2 text-sm text-ok">
            {metaMessage}
          </p>
        ) : null}

        {pickPhones.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Bağlanacak numarayı seçin</p>
            {pickPhones.map((p) => (
              <button
                key={p.phoneNumberId}
                type="button"
                disabled={metaBusy}
                onClick={() => void pickPhone(p.phoneNumberId)}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-left text-sm hover:border-brand/40 disabled:opacity-60"
              >
                <span>
                  <span className="font-semibold">{p.verifiedName}</span>
                  <span className="mt-0.5 block text-ink-muted">
                    {p.displayPhone || p.phoneNumberId}
                  </span>
                </span>
                <span className="text-brand">Bağla</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            {meta?.configured && meta.canManage ? (
              <>
                {meta.configId ? (
                  <button
                    type="button"
                    disabled={metaBusy || (!sdkReady && Boolean(meta.configId))}
                    onClick={() => launchEmbeddedSignup()}
                    className="rounded-xl bg-[#1877F2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#166fe5] disabled:opacity-60"
                  >
                    {metaBusy
                      ? "Facebook bağlanıyor…"
                      : "Facebook ile WhatsApp bağla"}
                  </button>
                ) : null}
                <a
                  href="/api/meta/oauth/start"
                  className="inline-flex rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:bg-brand-soft"
                >
                  {meta.configId
                    ? "Alternatif: Facebook OAuth"
                    : "Facebook ile WhatsApp bağla"}
                </a>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                {!meta?.configured
                  ? "Yönetici: .env içine META_APP_ID ve META_APP_SECRET ekleyin, Facebook uygulamasında yönlendirme URI’sini kaydedin."
                  : "Cloud bağlantısı için Yönetici veya Hesap sahibi rolü gerekir."}
              </p>
            )}
          </div>
        )}

        <p className="mt-4 text-xs text-ink-muted">
          Webhook URL:{" "}
          <code className="rounded bg-brand-soft px-1">
            https://wasys.pro/api/webhooks/meta
          </code>
          {" · "}
          OAuth redirect:{" "}
          <code className="rounded bg-brand-soft px-1">
            https://wasys.pro/api/meta/oauth/callback
          </code>
        </p>
      </section>
    </div>
  );
}
