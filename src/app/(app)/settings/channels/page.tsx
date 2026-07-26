"use client";

import { useEffect, useState } from "react";

type Channel = {
  id: string;
  name: string;
  type: string;
  status: string;
  phoneNumber: string | null;
  qrData: string | null;
  lastError: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  CONNECTING: "Bağlanıyor…",
  QR_PENDING: "QR bekleniyor",
  CONNECTED: "Bağlı",
  DISCONNECTED: "Bağlı değil",
  ERROR: "Hata",
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [cloudForm, setCloudForm] = useState({
    name: "WhatsApp Cloud",
    phoneNumber: "",
    metaPhoneId: "",
    metaToken: "",
    metaWabaId: "",
  });

  const qrChannels = channels.filter((c) => c.type === "WHATSAPP_QR");
  const canAddQr = qrChannels.length === 0;

  async function load() {
    const res = await fetch("/api/channels");
    const data = await res.json();
    setChannels(data.channels ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const pending = channels.filter((c) => c.type === "WHATSAPP_QR" && ["CONNECTING", "QR_PENDING"].includes(c.status));
    if (!pending.length) return;
    const t = setInterval(async () => {
      for (const c of pending) {
        const res = await fetch(`/api/channels/${c.id}/connect`);
        const data = await res.json();
        if (data.channel) {
          setChannels((prev) => prev.map((x) => (x.id === c.id ? data.channel : x)));
        }
      }
    }, 2500);
    return () => clearInterval(t);
  }, [channels]);

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
    if (!confirm("WhatsApp bağlantısı kesilsin mi? Yeniden bağlanmak için tekrar QR taramanız gerekir.")) return;
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
      alert("Bu hesapta zaten bir WhatsApp QR kanalı var. Şimdilik tek numara bağlanabilir.");
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

  async function addCloudChannel(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "WHATSAPP_CLOUD", ...cloudForm }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Cloud kanalı eklenemedi");
      return;
    }
    if (data.channel) {
      setChannels((prev) => [...prev, data.channel]);
      setCloudForm({
        name: "WhatsApp Cloud",
        phoneNumber: "",
        metaPhoneId: "",
        metaToken: "",
        metaWabaId: "",
      });
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Kanallar</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Öncelikli bağlantı: WhatsApp QR (hesap başına tek numara). Cloud API ikinci yöntem olarak hazır.
        </p>
      </div>

      <div className="space-y-4">
        {channels.map((channel) => (
          <div key={channel.id} className="rounded-2xl border border-line bg-bg-elevated p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{channel.name}</div>
                <div className="mt-1 text-xs text-ink-muted">
                  {channel.type === "WHATSAPP_QR" ? "WhatsApp QR" : "WhatsApp Cloud API"} ·{" "}
                  {STATUS_LABELS[channel.status] ?? channel.status}
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
                <div className="flex flex-col items-end gap-2">
                  <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand-deep">
                    Webhook: /api/webhooks/meta
                  </span>
                  <button
                    type="button"
                    disabled={loadingId === channel.id}
                    onClick={async () => {
                      setLoadingId(channel.id);
                      const res = await fetch(`/api/channels/${channel.id}/cloud`, {
                        method: "POST",
                      });
                      const data = await res.json();
                      setLoadingId(null);
                      if (data.error) {
                        alert(data.error);
                        if (data.channel) {
                          setChannels((prev) =>
                            prev.map((c) => (c.id === channel.id ? data.channel : c)),
                          );
                        }
                        return;
                      }
                      if (data.channel) {
                        setChannels((prev) =>
                          prev.map((c) => (c.id === channel.id ? data.channel : c)),
                        );
                      }
                    }}
                    className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:bg-brand-soft disabled:opacity-60"
                  >
                    {loadingId === channel.id ? "Doğrulanıyor…" : "Meta ile doğrula"}
                  </button>
                </div>
              )}
            </div>

            {channel.qrData && channel.status !== "CONNECTED" ? (
              <div className="mt-5 flex flex-col items-center gap-4 rounded-xl border border-dashed border-line bg-white p-6 md:flex-row md:items-start md:justify-center md:gap-8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={channel.qrData} alt="WhatsApp QR" className="h-56 w-56 shrink-0" />
                <ol className="max-w-xs list-decimal space-y-2 pl-5 text-sm text-ink-muted md:pt-4">
                  <li>Telefonunuzda <strong>WhatsApp</strong>’ı açın</li>
                  <li><strong>Ayarlar → Bağlı Cihazlar</strong>’a gidin</li>
                  <li><strong>Cihaz Bağla</strong>’ya dokunun</li>
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
              <p className="mt-4 text-sm text-ok">Bağlantı aktif. Mesajlar gelen kutusuna düşecek.</p>
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
            WhatsApp QR limiti: bu hesapta tek numara. Yeni numara için önce mevcut bağlantıyı kesin veya destek ile iletişime geçin.
          </p>
        )}
      </div>

      <form onSubmit={addCloudChannel} className="rounded-2xl border border-line bg-bg-elevated p-5">
        <h2 className="font-[family-name:var(--font-display)] text-xl">WhatsApp Cloud API ekle</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Meta Business → WhatsApp → API Setup bilgilerini girin. Kayıt sırasında token
          Meta&apos;da doğrulanır. Webhook URL:{" "}
          <code className="text-xs">https://wasys.pro/api/webhooks/meta</code>
          {" · "}
          Verify token: <code className="text-xs">META_VERIFY_TOKEN</code> (.env)
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(
            [
              ["name", "Kanal adı"],
              ["phoneNumber", "Telefon"],
              ["metaPhoneId", "Phone Number ID"],
              ["metaWabaId", "WABA ID"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm">
              <span className="mb-1 block font-medium">{label}</span>
              <input
                value={cloudForm[key]}
                onChange={(e) => setCloudForm((s) => ({ ...s, [key]: e.target.value }))}
                className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none ring-brand focus:ring-2"
              />
            </label>
          ))}
          <label className="text-sm md:col-span-2">
            <span className="mb-1 block font-medium">Access Token</span>
            <input
              value={cloudForm.metaToken}
              onChange={(e) => setCloudForm((s) => ({ ...s, metaToken: e.target.value }))}
              className="w-full rounded-xl border border-line bg-white px-3 py-2 outline-none ring-brand focus:ring-2"
            />
          </label>
        </div>
        <button type="submit" className="mt-4 rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-white">
          Cloud kanalı kaydet
        </button>
      </form>
    </div>
  );
}
