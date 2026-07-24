import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { packageLabel } from "@/lib/plans";
import { isPlatformAdmin } from "@/lib/platform-admin";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  return (
    <AppShell
      userName={session.user.name ?? "Kullanıcı"}
      orgName={session.user.organizationName}
      plan={packageLabel(session.user.plan)}
      isPlatformAdmin={isPlatformAdmin(session.user.email)}
    >
      {children}
    </AppShell>
  );
}
