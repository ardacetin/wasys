import { featureDenied } from "@/lib/feature-gate";

/** API erişimi kaldırıldı. */
export async function DELETE() {
  return featureDenied("apiAccess");
}
