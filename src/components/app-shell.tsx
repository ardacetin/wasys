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
  CreditCard,
  GitBranch,
  Inbox,
  LayoutDashboard,
  Radio,
  Tags,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NewMessageNotifier } from "@/components/new-message-notifier";

type NavLink = { href: string; label: string; icon: LucideIcon };

const tenantMainLinks: NavLink[] = [
  { href: "/inbox", label: "Gelen kutusu", icon: Inbox },
  { href: "/crm", label: "CRM", icon: BookUser },
  { href: "/reports", label: "Raporlar", icon: BarChart3 },
];

const tenantSettingsLinks: NavLink[] = [
  { href: "/settings/channels", label: "Kanallar", icon: Radio },
  { href: "/settings/rules", label: "Atama kuralları", icon: GitBranch },
  { href: "/settings/automation", label: "Otomasyon", icon: Zap },
  { href: "/settings/library", label: "Etiketler & şablonlar", icon: Tags },
  { href: "/settings/team", label: "Ekip", icon: Users },
  { href: "/settings/plan", label: "Paket", icon: CreditCard },
];

const platformLinks: NavLink[] = [
  { href: "/admin", label: "Özet", icon: LayoutDashboard },
  { href: "/admin/accounts", label: "Müşteriler", icon: Building2 },
  { href: "/admin/users", label: "Kullanıcılar", icon: Users },
  { href: "/admin/quote-requests", label: "Talepler", icon: ClipboardList },
];

function linkActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname.startsWith(href);
}

function NavItem({
  link,
  pathname,
  nested = false,
}: {
  link: NavLink;
  pathname: string;
  nested?: boolean;
}) {
  const Icon = link.icon;
  const active = linkActive(pathname, link.href);
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-3 rounded-xl py-2.5 text-sm transition",
        nested ? "px-3 pl-9" : "px-3",
        active
          ? "bg-brand text-white"
          : "text-white/70 hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon size={18} />
      {link.label}
    </Link>
  );
}

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
  const mobileLinks = isPlatformAdmin
    ? platformLinks
    : [...tenantMainLinks, ...tenantSettingsLinks];

  useEffect(() => {
    if (!isPlatformAdmin) return;
    if (!pathname.startsWith("/admin")) {
      router.replace("/admin");
    }
  }, [isPlatformAdmin, pathname, router]);

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
          {isPlatformAdmin
            ? platformLinks.map((link) => (
                <NavItem key={link.href} link={link} pathname={pathname} />
              ))
            : (
              <>
                {tenantMainLinks.map((link) => (
                  <NavItem key={link.href} link={link} pathname={pathname} />
                ))}
                <div className="mt-4 mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
                  Ayarlar
                </div>
                {tenantSettingsLinks.map((link) => (
                  <NavItem
                    key={link.href}
                    link={link}
                    pathname={pathname}
                    nested
                  />
                ))}
              </>
            )}
        </nav>
        <div className="border-t border-white/10 p-4">
          <div className="text-sm font-medium">{userName}</div>
          <div className="mt-0.5 text-xs text-white/50">
            {isPlatformAdmin ? "Süper yönetici" : `${plan} paket`}
          </div>
          {!isPlatformAdmin ? <NewMessageNotifier enabled /> : null}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-3 text-xs text-white/60 hover:text-white"
          >
            Çıkış yap
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-col gap-2 border-b border-line bg-bg-elevated/80 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="font-[family-name:var(--font-display)] text-xl text-brand-deep">
              WASYS
            </div>
            <div className="flex max-w-[60%] gap-2 overflow-x-auto text-xs">
              {mobileLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="shrink-0 rounded-full border border-line px-3 py-1"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
          {!isPlatformAdmin ? (
            <NewMessageNotifier enabled variant="light" />
          ) : null}
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
