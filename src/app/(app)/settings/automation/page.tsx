"use client";

import { FormEvent, useEffect, useState } from "react";

type Settings = {
  welcomeMessageEnabled: boolean;
  welcomeMessage: string | null;
  awayMessageEnabled: boolean;
  awayMessage: string | null;
  distributionMode: "NONE" | "BALANCED" | "RANDOM";
  alertEmail: string | null;
};

export default function AutomationPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/automation");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Ayarlar yüklenemedi");
        return;
      }
      setSettings(data.settings);
      setSmtpConfigured(data.smtpConfigured);
    })();
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!settings) return;
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const res = await fetch("/api/automation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Kaydedilemedi");
        return;
      }
      setSettings(data.settings);
      setSuccess("Otomasyon ayarları kaydedildi.");
    } catch {
      setError("Sunucuya ulaşılamadı, tekrar deneyin");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return (
      <div className="mx-auto max-w-3xl p-6 text-sm text-ink-muted">
        {error || "Yükleniyor…"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">Otomasyon</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Otomatik mesajlar, sohbet dağıtımı ve bağlantı uyarıları
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <section className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Karşılama mesajı</h2>
              <p className="text-xs text-ink-muted">
                Yeni bir sohbet başladığında WhatsApp&apos;tan otomatik gönderilir
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.welcomeMessageEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, welcomeMessageEnabled: e.target.checked })
                }
                className="h-4 w-4 accent-brand"
              />
              Aktif
            </label>
          </div>
          <textarea
            value={settings.welcomeMessage ?? ""}
            onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
            rows={3}
            placeholder="Merhaba {{ad}}! Mesajınız bize ulaştı, en kısa sürede dönüş yapacağız."
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          />
          <p className="text-xs text-ink-muted">
            Değişkenler: <code>{"{{ad}}"}</code> kişinin adı, <code>{"{{telefon}}"}</code> numarası
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Meşgul mesajı</h2>
              <p className="text-xs text-ink-muted">
                Panelde aktif kimse yokken gelen mesajlara otomatik gönderilir
                (aynı sohbete 4 saatte bir)
              </p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={settings.awayMessageEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, awayMessageEnabled: e.target.checked })
                }
                className="h-4 w-4 accent-brand"
              />
              Aktif
            </label>
          </div>
          <textarea
            value={settings.awayMessage ?? ""}
            onChange={(e) => setSettings({ ...settings, awayMessage: e.target.value })}
            rows={3}
            placeholder="Şu anda müsait değiliz. Mesajınızı aldık, çalışma saatlerimizde dönüş yapacağız."
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          />
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-5">
          <h2 className="font-semibold">Sohbet dağıtımı</h2>
          <p className="text-xs text-ink-muted">
            Atama kurallarına uymayan yeni sohbetler ekibe nasıl dağıtılsın?
          </p>
          <select
            value={settings.distributionMode}
            onChange={(e) =>
              setSettings({
                ...settings,
                distributionMode: e.target.value as Settings["distributionMode"],
              })
            }
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="NONE">Dağıtma (atamasız kalsın)</option>
            <option value="BALANCED">Eşit dağıt (en az sohbeti olana ver)</option>
            <option value="RANDOM">Rastgele dağıt</option>
          </select>
          <p className="text-xs text-ink-muted">
            Öncelik son 5 dakikada panelde aktif olan ekip üyelerindedir; kimse
            çevrimiçi değilse tüm ekip arasında dağıtılır.
          </p>
        </section>

        <section className="space-y-3 rounded-2xl border border-line bg-bg-elevated p-5">
          <h2 className="font-semibold">Bağlantı uyarısı</h2>
          <p className="text-xs text-ink-muted">
            WhatsApp bağlantısı (QR veya API) koptuğunda bu adrese otomatik
            e-posta gönderilir. Boş bırakılırsa yöneticilerin e-postalarına gider.
          </p>
          <input
            type="email"
            value={settings.alertEmail ?? ""}
            onChange={(e) =>
              setSettings({ ...settings, alertEmail: e.target.value || null })
            }
            placeholder="uyari@firmaniz.com"
            className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
          />
          {smtpConfigured === false ? (
            <p className="rounded-xl bg-warn/10 px-3 py-2 text-xs text-ink">
              SMTP henüz yapılandırılmamış. Hostinger .env dosyasına SMTP_HOST,
              SMTP_PORT, SMTP_USER, SMTP_PASS (ve isteğe bağlı SMTP_FROM)
              değişkenlerini ekleyip uygulamayı yeniden başlatın; e-postalar o
              zaman gönderilecek.
            </p>
          ) : smtpConfigured === true ? (
            <p className="text-xs text-ok">SMTP yapılandırılmış, e-postalar aktif.</p>
          ) : null}
        </section>

        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {success ? <p className="text-sm text-ok">{success}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </form>
    </div>
  );
}
