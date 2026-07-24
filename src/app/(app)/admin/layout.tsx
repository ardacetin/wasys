import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/giris");
  if (!isPlatformAdmin(session.user.email)) redirect("/inbox");
  return <>{children}</>;
}
