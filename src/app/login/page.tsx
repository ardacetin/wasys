"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const configError = searchParams.get("error") === "Configuration";

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError(
        res.error === "Configuration"
          ? "Sunucu yapılandırması eksik (AUTH_SECRET). Hosting env değişkenlerini kontrol edin."
          : "E-posta veya şifre hatalı",
      );
      return;
    }
    router.push("/inbox");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md animate-rise rounded-2xl border border-line bg-bg-elevated/90 p-8 shadow-xl backdrop-blur">
      <Link href="/" className="font-[family-name:var(--font-display)] text-2xl text-brand-deep">
        WASYS
      </Link>
      <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl">Giriş yap</h1>
      <p className="mt-2 text-sm text-ink-muted">Ekip gelen kutunuza devam edin.</p>

      {configError ? (
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          Auth yapılandırması eksik. Hosting panelinde <code>AUTH_SECRET</code> ve{" "}
          <code>AUTH_URL=https://wasys.pro</code> tanımlayın, ardından yeniden deploy edin.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">E-posta</span>
          <input
            name="email"
            type="email"
            required
            defaultValue="demo@wasys.app"
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-brand focus:ring-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Şifre</span>
          <input
            name="password"
            type="password"
            required
            defaultValue="demo1234"
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 outline-none ring-brand focus:ring-2"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand py-2.5 font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
        >
          {loading ? "Giriş yapılıyor..." : "Giriş yap"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Hesabınız yok mu?{" "}
        <Link href="/register" className="font-semibold text-brand">
          Kayıt ol
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
