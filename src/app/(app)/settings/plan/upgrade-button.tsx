"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PlanUpgradeButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function upgrade() {
    setLoading(true);
    const res = await fetch("/api/plan/upgrade", { method: "POST" });
    setLoading(false);
    if (res.ok) {
      router.refresh();
    } else {
      const data = await res.json();
      alert(data.error ?? "Yükseltme başarısız");
    }
  }

  return (
    <button
      onClick={() => void upgrade()}
      disabled={loading}
      className="mt-5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
    >
      {loading ? "Yükseltiliyor..." : "Pro'ya yükselt (demo)"}
    </button>
  );
}
