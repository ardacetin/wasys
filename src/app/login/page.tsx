"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setError("E-posta veya şifre hatalı");
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
        <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl">Giriş yap</h1>
        <p className="mt-2 text-sm text-ink-muted">Ekip gelen kutunuza devam edin.</p>

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
    </main>
  );
}
