import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/giris", req.url), 307);
}

export async function POST() {
  return NextResponse.json(
    { error: "Dışarıdan kayıt kapalıdır." },
    { status: 403 },
  );
}
