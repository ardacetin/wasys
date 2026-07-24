import { NextResponse } from "next/server";
import { featureDenied } from "@/lib/feature-gate";

/** API erişimi kaldırıldı. */
export async function GET() {
  return featureDenied("apiAccess");
}

export async function POST() {
  return featureDenied("apiAccess");
}
