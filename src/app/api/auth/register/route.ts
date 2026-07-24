import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Dışarıdan kayıt kapalıdır. Hesaplar yalnızca WASYS platform yöneticisi tarafından açılır.",
    },
    { status: 403 },
  );
}
