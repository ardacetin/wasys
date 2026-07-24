"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  Building2,
  GitBranch,
  Inbox,
  KeyRound,
  MessageSquareText,
  Radio,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/inbox", label: "Gelen kutusu", icon: Inbox },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
  { href: "/settings/channels", label: "Kanallar", icon: Radio },
  { href: "/settings/rules", label: "Atama kuralları", icon: GitBranch },
  { href: "/settings/templates", label: "Şablonlar", icon: MessageSquareText },
  { href: "/settings/team", label: "Ekip", icon: Users },
  { href: "/settings/api", label: "API", icon: KeyRound },
  { href: "/settings/plan", label: "Paket", icon: Settings },
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
  const visibleLinks = isPlatformAdmin
    ? [
        { href: "/admin/accounts", label: "Müşteri hesapları", icon: Building2 },
        ...links,
      ]
    : links;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-panel text-panel-ink md:flex md:flex-col">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="font-[family-name:var(--font-display)] text-2xl tracking-tight">WASYS</div>
          <div className="mt-1 truncate text-xs text-white/55">{orgName}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {visibleLinks.map((link) => {
            const Icon = link.icon;
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active ? "bg-brand text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
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
          <div className="mt-0.5 text-xs text-white/50">{plan} paket</div>
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
          <div className="font-[family-name:var(--font-display)] text-xl text-brand-deep">WASYS</div>
          <div className="flex gap-2 overflow-x-auto text-xs">
            {visibleLinks.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-full border border-line px-3 py-1">
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
