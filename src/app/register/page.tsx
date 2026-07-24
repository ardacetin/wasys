"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const payload = {
      organizationName: String(form.get("organizationName")),
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
    };

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoading(false);
      setError(data.error ?? "Kayıt başarısız");
      return;
    }

    const login = await signIn("credentials", {
      email: payload.email,
      password: payload.password,
      redirect: false,
    });
    setLoading(false);
    if (login?.error) {
      setError("Kayıt oldu, giriş başarısız. Lütfen giriş sayfasını deneyin.");
      return;
    }
    router.push("/inbox");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-rise rounded-2xl border border-line bg-bg-elevated/90 p-8 shadow-xl backdrop-blur">
        <Link href="/" className="font-[family-name:var(--font-display)] text-2xl text-brand-deep">
          WASYS
        </Link>
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl">Organizasyon oluştur</h1>
        <p className="mt-2 text-sm text-ink-muted">Basic paket ile 5 kullanıcıya kadar başlayın.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Şirket / marka</span>
            <input
              name="organizationName"
              required
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Adınız</span>
            <input
              name="name"
              required
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">E-posta</span>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-brand focus:ring-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Şifre</span>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-brand focus:ring-2"
            />
          </label>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-brand py-2.5 font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
          >
            {loading ? "Oluşturuluyor..." : "Hesabı oluştur"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="font-semibold text-brand">
            Giriş yap
          </Link>
        </p>
      </div>
    </main>
  );
}
