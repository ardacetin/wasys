import { featureDenied } from "@/lib/feature-gate";

/** Public API kaldırıldı. */
export async function GET() {
  return featureDenied("apiAccess");
}
