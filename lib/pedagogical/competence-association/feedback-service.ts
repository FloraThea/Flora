import { floraDb } from "@/lib/supabase/get-db";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import type { CompetenceFeedbackInput } from "./types";

export async function recordCompetenceFeedback(input: CompetenceFeedbackInput): Promise<void> {
  const { error } = await (await floraDb()).from("competence_association_feedback").insert({
    teacher_profile_id: input.teacherProfileId,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    content_hash: input.contentHash,
    matiere: input.matiere ?? null,
    niveau: input.niveau ?? null,
    methode: input.methode ?? null,
    proposed_referentiel_id: input.proposedReferentielId ?? null,
    final_referentiel_id: input.finalReferentielId ?? null,
    action: input.action,
    confidence: input.confidence ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible d'enregistrer le feedback de compétence."));
  }
}

export async function loadFeedbackBoosts(input: {
  teacherProfileId?: string;
  contentHash: string;
  matiere?: string;
}): Promise<Map<string, number>> {
  const boosts = new Map<string, number>();
  if (!input.teacherProfileId) return boosts;

  let query = (await floraDb())
    .from("competence_association_feedback")
    .select("final_referentiel_id, proposed_referentiel_id, action, content_hash, confidence")
    .eq("teacher_profile_id", input.teacherProfileId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (input.matiere) {
    query = query.eq("matiere", input.matiere);
  }

  const { data, error } = await query;
  if (error || !data) return boosts;

  for (const row of data) {
    const referentielId = String(row.final_referentiel_id ?? row.proposed_referentiel_id ?? "");
    if (!referentielId) continue;

    let boost = 0;
    if (row.action === "accepted" || row.action === "added") boost = 0.8;
    if (row.action === "replaced" && row.final_referentiel_id) boost = 0.65;
    if (row.action === "rejected" || row.action === "removed") boost = -0.4;

    if (row.content_hash === input.contentHash) {
      boost += 0.2;
    }

    const previous = boosts.get(referentielId) ?? 0;
    boosts.set(referentielId, Math.max(previous, boost));
  }

  return boosts;
}
