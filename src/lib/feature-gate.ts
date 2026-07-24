import { NextResponse } from "next/server";
import type { Plan } from "@prisma/client";
import { hasFeature, type FeatureKey } from "@/lib/plans";

export function featureDenied(feature: FeatureKey) {
  return NextResponse.json(
    {
      error: `Bu özellik Pro paket gerektirir (${feature})`,
      upgradeRequired: true,
      feature,
    },
    { status: 403 },
  );
}

export function assertFeature(plan: Plan, feature: FeatureKey) {
  return hasFeature(plan, feature);
}
