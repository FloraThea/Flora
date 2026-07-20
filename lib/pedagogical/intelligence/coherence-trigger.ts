import "server-only";

import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { analyzePedagogicalCoherence } from "./coherence-analyzer";
import {
  coherenceCacheKey,
  invalidatePedagogicalCache,
  setPedagogicalCache,
} from "./coherence-cache";

/** Déclenché après import ou modification — invalide le cache et relance l'analyse. */
export async function triggerPedagogicalAnalysis(input?: {
  reason?: string;
  module?: string;
  entityId?: string;
}): Promise<{ issueCount: number }> {
  const scope = await requireTeacherScope();
  invalidatePedagogicalCache(scope.profileId);

  const issues = await analyzePedagogicalCoherence();
  setPedagogicalCache(coherenceCacheKey(scope.profileId), issues, 120_000);

  if (process.env.NODE_ENV === "development" && input?.reason) {
    console.info("[MPI] Analyse relancée", {
      reason: input.reason,
      module: input.module,
      entityId: input.entityId,
      issueCount: issues.length,
    });
  }

  return { issueCount: issues.length };
}
