import { NextResponse } from "next/server";
import { publicUrl } from "@/lib/public-url";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.redirect(publicUrl("/giris", req), 307);
}

export async function POST() {
  return NextResponse.json(
    { error: "Dışarıdan kayıt kapalıdır." },
    { status: 403 },
  );
}
