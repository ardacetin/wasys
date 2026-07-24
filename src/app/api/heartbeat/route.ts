import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Panel açıkken çevrimiçi sinyali. Meşgul mesajı ve dengeli dağıtım
 * lastActiveAt'a bakar; yalnızca gelen kutusu poll'una bağlı kalmasın.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.updateMany({
    where: { id: session.user.id },
    data: { lastActiveAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
