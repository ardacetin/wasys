"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

export function QuoteForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    const form = event.currentTarget;
    const fields = new FormData(form);
    const res = await fetch("/api/quote-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: fields.get("fullName"),
        email: fields.get("email"),
        phone: fields.get("phone"),
        userCount: fields.get("userCount"),
        website: fields.get("website"),
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      const firstFieldError = data.fields
        ? Object.values(data.fields).flat().find(Boolean)
        : null;
      setError(String(firstFieldError ?? data.error ?? "Talebiniz gönderilemedi."));
      return;
    }

    setSuccess(data.message);
    form.reset();
  }

  if (success) {
    return (
      <div
        className="flex min-h-[28rem] flex-col items-center justify-center rounded-[1.75rem] border border-brand/20 bg-white p-8 text-center shadow-[0_24px_80px_rgba(7,94,84,0.12)]"
        role="status"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand-deep">
          <CheckCircle2 size={32} aria-hidden="true" />
        </span>
        <h3 className="mt-5 font-[family-name:var(--font-display)] text-2xl text-ink">
          Talebiniz bize ulaştı
        </h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-ink-muted">{success}</p>
        <button
          type="button"
          onClick={() => setSuccess("")}
          className="mt-6 min-h-11 rounded-full border border-line px-5 text-sm font-semibold text-brand-deep transition hover:border-brand hover:bg-brand-soft/50"
        >
          Yeni talep oluştur
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[1.75rem] border border-white/70 bg-white p-5 shadow-[0_24px_80px_rgba(7,94,84,0.14)] sm:p-7"
      aria-label="Teklif talep formu"
    >
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Teklif al</p>
        <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-ink">
          Kullanıcı sayınıza göre fiyatlandırma
        </h3>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          Tek paket, tüm özellikler dahil. Kaç kişinin kullanacağını yazın; size özel
          teklif hazırlayalım.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-ink sm:col-span-2">
          Ad soyad
          <input
            name="fullName"
            autoComplete="name"
            required
            minLength={3}
            placeholder="Adınız ve soyadınız"
            className="mt-1.5 min-h-12 w-full rounded-xl border border-line bg-white px-3.5 font-normal outline-none transition placeholder:text-ink-muted/60 focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          Telefon
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            required
            placeholder="+90 5xx xxx xx xx"
            className="mt-1.5 min-h-12 w-full rounded-xl border border-line bg-white px-3.5 font-normal outline-none transition placeholder:text-ink-muted/60 focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </label>
        <label className="text-sm font-semibold text-ink">
          E-posta
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="siz@sirket.com"
            className="mt-1.5 min-h-12 w-full rounded-xl border border-line bg-white px-3.5 font-normal outline-none transition placeholder:text-ink-muted/60 focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </label>
        <label className="text-sm font-semibold text-ink sm:col-span-2">
          Kaç kullanıcı kullanacak?
          <input
            name="userCount"
            type="number"
            inputMode="numeric"
            min={1}
            max={10000}
            required
            defaultValue={5}
            className="mt-1.5 min-h-12 w-full rounded-xl border border-line bg-white px-3.5 font-normal outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
          <span className="mt-1.5 block text-xs font-normal text-ink-muted">
            Fiyatlandırmayı belirleyen tek ölçü kullanıcı sayısıdır.
          </span>
        </label>
      </div>

      <div className="absolute -left-[9999px]" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-ink-muted">
        <input type="checkbox" required className="mt-1 h-4 w-4 accent-brand" />
        Teklif talebim kapsamında WASYS ekibinin benimle iletişime geçmesini kabul ediyorum.
      </label>

      {error ? (
        <p className="mt-4 rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(18,140,126,0.22)] transition hover:bg-brand-deep focus:outline-none focus:ring-4 focus:ring-brand/20 disabled:cursor-wait disabled:opacity-65"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
        {loading ? "Gönderiliyor..." : "Teklif talebi gönder"}
      </button>
      <p className="mt-3 text-center text-[11px] leading-5 text-ink-muted">
        Bilgileriniz yalnızca teklif süreci için kullanılır. Dışarıdan otomatik üyelik oluşturulmaz.
      </p>
    </form>
  );
}
