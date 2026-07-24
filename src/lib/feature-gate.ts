import { NextResponse } from "next/server";

/** Kaldırılan Pro özelliği — API erişimi artık sunulmuyor. */
export function featureDenied(feature: string) {
  return NextResponse.json(
    {
      error: `Bu özellik artık sunulmuyor (${feature})`,
      unavailable: true,
      feature,
    },
    { status: 410 },
  );
}
