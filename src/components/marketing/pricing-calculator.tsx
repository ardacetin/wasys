"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Minus, Plus } from "lucide-react";
import {
  LIST_PRICE_PER_USER_USD,
  MONTHLY_PRICE_PER_USER_USD,
  SETUP_FEE_USD,
} from "@/lib/plans";

const MIN_USERS = 1;
const MAX_USERS = 100;

export function PricingCalculator() {
  const [users, setUsers] = useState(1);

  const monthly = useMemo(() => users * MONTHLY_PRICE_PER_USER_USD, [users]);
  const listMonthly = useMemo(() => users * LIST_PRICE_PER_USER_USD, [users]);
  const firstMonth = monthly + SETUP_FEE_USD;

  function bump(delta: number) {
    setUsers((n) => Math.min(MAX_USERS, Math.max(MIN_USERS, n + delta)));
  }

  return (
    <div className="mx-auto mt-12 max-w-xl rounded-[1.75rem] border border-brand-deep/10 bg-white p-7 shadow-[0_24px_70px_rgba(7,94,84,0.1)] sm:p-9">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-brand">WASYS · Kullanıcı başına</p>
          <h3 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-brand-deep">
            Basit fiyatlandırma
          </h3>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Liste
          </p>
          <p className="text-lg font-bold text-ink-muted line-through decoration-ink-muted/50">
            ${LIST_PRICE_PER_USER_USD}
            <span className="text-sm font-semibold">/kullanıcı/ay</span>
          </p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-brand-deep/10 bg-brand-soft/40 p-5">
        <p className="text-center text-xs font-bold uppercase tracking-[0.16em] text-brand">
          Kullanıcı sayısı
        </p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => bump(-1)}
            disabled={users <= MIN_USERS}
            aria-label="Kullanıcı azalt"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-brand-deep/15 bg-white text-brand-deep transition hover:border-brand hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Minus size={20} strokeWidth={2.5} />
          </button>
          <div className="min-w-[5.5rem] text-center">
            <p className="font-[family-name:var(--font-display)] text-5xl tracking-tight text-brand-deep">
              {users}
            </p>
            <p className="text-xs font-semibold text-ink-muted">
              {users === 1 ? "kullanıcı" : "kullanıcı"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => bump(1)}
            disabled={users >= MAX_USERS}
            aria-label="Kullanıcı artır"
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-brand-deep/15 bg-white text-brand-deep transition hover:border-brand hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
        <input
          type="range"
          min={MIN_USERS}
          max={Math.min(20, MAX_USERS)}
          value={Math.min(users, 20)}
          onChange={(e) => setUsers(Number(e.target.value))}
          className="mt-5 w-full accent-brand"
          aria-label="Kullanıcı sayısı kaydırıcı"
        />
        {users > 20 ? (
          <p className="mt-2 text-center text-xs text-ink-muted">
            20+ için + / − ile devam edin (en fazla {MAX_USERS}).
          </p>
        ) : null}
      </div>

      <dl className="mt-8 space-y-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">Tek seferlik kurulum</dt>
          <dd className="font-bold text-ink">${SETUP_FEE_USD}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-ink-muted">
            Aylık ({users} × ${MONTHLY_PRICE_PER_USER_USD})
          </dt>
          <dd className="text-right">
            <span className="mr-2 text-xs font-semibold text-ink-muted line-through">
              ${listMonthly}
            </span>
            <span className="font-bold text-ink">${monthly}</span>
            <span className="text-ink-muted">/ay</span>
          </dd>
        </div>
        <div className="border-t border-brand-deep/10 pt-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="font-semibold text-brand-deep">İlk ay toplam</dt>
            <dd className="font-[family-name:var(--font-display)] text-3xl text-brand-deep">
              ${firstMonth}
            </dd>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Sonraki aylar: ${monthly}/ay · kurulum bir kez alınır
          </p>
        </div>
      </dl>

      <a
        href={`/?users=${users}#teklif`}
        className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-[0_12px_30px_rgba(18,140,126,0.22)] transition hover:bg-brand-deep"
      >
        Bu ölçek için teklif iste
        <ArrowRight size={16} />
      </a>
      <p className="mt-3 text-center text-[11px] leading-5 text-ink-muted">
        Fiyatlar USD · KDV hariç · Taahhüt yok, teklif sonrası netleşir
      </p>
    </div>
  );
}
