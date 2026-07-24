"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  BookUser,
  Building2,
  ClipboardList,
  GitBranch,
  Inbox,
  LayoutDashboard,
  MessageSquareText,
  Radio,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tenantLinks = [
  { href: "/inbox", label: "Gelen kutusu", icon: Inbox },
  { href: "/crm", label: "CRM", icon: BookUser },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/settings/channels", label: "Kanallar", icon: Radio },
  { href: "/settings/rules", label: "Atama kuralları", icon: GitBranch },
  { href: "/settings/automation", label: "Otomasyon", icon: Zap },
  { href: "/settings/templates", label: "Şablonlar", icon: MessageSquareText },
  { href: "/settings/team", label: "Ekip", icon: Users },
  { href: "/settings/plan", label: "Paket", icon: Settings },
];

const platformLinks = [
  { href: "/admin", label: "Özet", icon: LayoutDashboard },
  { href: "/admin/accounts", label: "Müşteriler", icon: Building2 },
  { href: "/admin/users", label: "Kullanıcılar", icon: Users },
  { href: "/admin/quote-requests", label: "Talepler", icon: ClipboardList },
];

export function AppShell({
  children,
  userName,
  orgName,
  plan,
  isPlatformAdmin,
}: {
  children: React.ReactNode;
  userName: string;
  orgName: string;
  plan: string;
  isPlatformAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visibleLinks = isPlatformAdmin ? platformLinks : tenantLinks;

  // Süper admin yalnızca SaaS paneline erişir; müşteri ekranlarına düşmesin.
  useEffect(() => {
    if (!isPlatformAdmin) return;
    if (!pathname.startsWith("/admin")) {
      router.replace("/admin");
    }
  }, [isPlatformAdmin, pathname, router]);

  // Çevrimiçi tespiti: meşgul mesajı + dengeli dağıtım için lastActiveAt
  useEffect(() => {
    if (isPlatformAdmin) return;
    const beat = () => {
      void fetch("/api/heartbeat", { method: "POST" }).catch(() => undefined);
    };
    beat();
    const t = setInterval(beat, 60_000);
    return () => clearInterval(t);
  }, [isPlatformAdmin]);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-panel text-panel-ink md:flex md:flex-col">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="font-[family-name:var(--font-display)] text-2xl tracking-tight">
            WASYS
          </div>
          <div className="mt-1 truncate text-xs text-white/55">
            {isPlatformAdmin ? "Platform yönetimi" : orgName}
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            const active =
              link.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-brand text-white"
                    : "text-white/70 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="text-sm font-medium">{userName}</div>
          <div className="mt-0.5 text-xs text-white/50">
            {isPlatformAdmin ? "Süper yönetici" : `${plan} paket`}
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-3 text-xs text-white/60 hover:text-white"
          >
            Çıkış yap
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-bg-elevated/80 px-4 py-3 backdrop-blur md:hidden">
          <div className="font-[family-name:var(--font-display)] text-xl text-brand-deep">
            WASYS
          </div>
          <div className="flex gap-2 overflow-x-auto text-xs">
            {visibleLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full border border-line px-3 py-1"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
