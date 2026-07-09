import { supabase } from "@/lib/supabase";
import type {
  SequenceDraft,
  SequenceEvaluation,
  SequencePayload,
  SequenceSession,
  StoredSequence,
} from "./types";

export async function saveSequence(input: {
  draft: SequenceDraft;
  progressionId: string;
  progressionRowId: string;
  programmationId: string;
  progressionTabId?: string;
}): Promise<SequencePayload> {
  const { data: sequence, error } = await supabase
    .from("sequences")
    .insert({
      progression_id: input.progressionId,
      progression_row_id: input.progressionRowId,
      programmation_id: input.programmationId,
      progression_tab_id: input.progressionTabId ?? null,
      title: input.draft.title,
      matiere: input.draft.matiere,
      sous_matiere: input.draft.sousMatiere,
      cycle: input.draft.cycle,
      niveau: input.draft.niveau,
      period_number: input.draft.periodNumber,
      week_numbers: input.draft.weekNumbers,
      competence_bo: input.draft.competenceBo,
      attendus: input.draft.attendus,
      objectifs: input.draft.objectifs,
      duree_estimee_minutes: input.draft.dureeEstimeeMinutes,
      session_count: input.draft.sessionCount,
      prerequis: input.draft.prerequis,
      notions: input.draft.notions,
      vocabulaire: input.draft.vocabulaire,
      materiel: input.draft.materiel,
      resources: input.draft.resources,
      methode: input.draft.methode,
      evaluation_finale: input.draft.evaluationFinale,
      differentiation: input.draft.differentiation,
      prolongements: input.draft.prolongements,
      referentiel_ids: input.draft.referentielIds,
      resource_ids: input.draft.resourceIds,
      status: "validated",
      metadata: {
        generated_at: new Date().toISOString(),
      },
    })
    .select("*")
    .single();

  if (error || !sequence) {
    throw error ?? new Error("Impossible d'enregistrer la séquence.");
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from("sequence_sessions")
    .insert(
      input.draft.sessions.map((session) => ({
        sequence_id: sequence.id,
        session_number: session.sessionNumber,
        title: session.title,
        objectif: session.objectif,
        duree_minutes: session.dureeMinutes,
        ordre_pedagogique: session.ordrePedagogique,
        place_progression: session.placeProgression,
      })),
    )
    .select("*");

  if (sessionsError) throw sessionsError;

  const { data: evaluations, error: evaluationsError } = await supabase
    .from("sequence_evaluations")
    .insert(
      input.draft.evaluations.map((evaluation) => ({
        sequence_id: sequence.id,
        evaluation_type: evaluation.evaluationType,
        label: evaluation.label,
        criteres: evaluation.criteres,
      })),
    )
    .select("*");

  if (evaluationsError) throw evaluationsError;

  return mapSequencePayload(
    sequence as StoredSequence,
    (sessions ?? []).map(
      (session): SequenceSession => ({
        id: session.id,
        sessionNumber: session.session_number,
        title: session.title,
        objectif: session.objectif,
        dureeMinutes: session.duree_minutes,
        ordrePedagogique: session.ordre_pedagogique,
        placeProgression: session.place_progression,
      }),
    ),
    (evaluations ?? []).map(
      (evaluation): SequenceEvaluation => ({
        id: evaluation.id,
        evaluationType: evaluation.evaluation_type as SequenceEvaluation["evaluationType"],
        label: evaluation.label,
        criteres: (evaluation.criteres as string[]) ?? [],
      }),
    ),
  );
}

function mapStoredSequence(row: Record<string, unknown>): StoredSequence {
  return {
    id: String(row.id),
    progression_id: String(row.progression_id),
    progression_row_id: String(row.progression_row_id),
    programmation_id: String(row.programmation_id),
    progression_tab_id: row.progression_tab_id ? String(row.progression_tab_id) : null,
    title: String(row.title ?? ""),
    matiere: String(row.matiere ?? ""),
    sousMatiere: String(row.sous_matiere ?? ""),
    cycle: String(row.cycle ?? ""),
    niveau: String(row.niveau ?? ""),
    periodNumber: Number(row.period_number ?? 0),
    weekNumbers: (row.week_numbers as number[]) ?? [],
    competenceBo: String(row.competence_bo ?? ""),
    attendus: (row.attendus as string[]) ?? [],
    objectifs: (row.objectifs as string[]) ?? [],
    dureeEstimeeMinutes: Number(row.duree_estimee_minutes ?? 0),
    sessionCount: Number(row.session_count ?? 0),
    prerequis: (row.prerequis as string[]) ?? [],
    notions: (row.notions as string[]) ?? [],
    vocabulaire: (row.vocabulaire as string[]) ?? [],
    materiel: (row.materiel as string[]) ?? [],
    resources: (row.resources as string[]) ?? [],
    methode: String(row.methode ?? ""),
    evaluationFinale: (row.evaluation_finale as StoredSequence["evaluationFinale"]) ?? {
      label: "",
      criteres: [],
    },
    differentiation: (row.differentiation as StoredSequence["differentiation"]) ?? {
      elevesEnDifficulte: [],
      elevesAvances: [],
      groupes: [],
      adaptations: [],
    },
    prolongements: (row.prolongements as string[]) ?? [],
    referentielIds: (row.referentiel_ids as string[]) ?? [],
    resourceIds: (row.resource_ids as string[]) ?? [],
    status: String(row.status ?? "draft"),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapSequencePayload(
  sequence: StoredSequence,
  sessions: SequenceSession[],
  evaluations: SequenceEvaluation[],
): SequencePayload {
  return { sequence, sessions, evaluations };
}

export async function loadSequence(id: string): Promise<SequencePayload | null> {
  const { data: sequence, error } = await supabase
    .from("sequences")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !sequence) return null;

  const [{ data: sessions }, { data: evaluations }] = await Promise.all([
    supabase
      .from("sequence_sessions")
      .select("*")
      .eq("sequence_id", id)
      .order("session_number"),
    supabase.from("sequence_evaluations").select("*").eq("sequence_id", id),
  ]);

  return mapSequencePayload(
    mapStoredSequence(sequence),
    (sessions ?? []).map(
      (session): SequenceSession => ({
        id: session.id,
        sessionNumber: session.session_number,
        title: session.title,
        objectif: session.objectif,
        dureeMinutes: session.duree_minutes,
        ordrePedagogique: session.ordre_pedagogique,
        placeProgression: session.place_progression,
      }),
    ),
    (evaluations ?? []).map(
      (evaluation): SequenceEvaluation => ({
        id: evaluation.id,
        evaluationType: evaluation.evaluation_type as SequenceEvaluation["evaluationType"],
        label: evaluation.label,
        criteres: (evaluation.criteres as string[]) ?? [],
      }),
    ),
  );
}

export async function listSequencesByProgression(progressionId: string) {
  const { data, error } = await supabase
    .from("sequences")
    .select("id, title, matiere, sous_matiere, period_number, week_numbers, session_count, progression_row_id, status")
    .eq("progression_id", progressionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getSequenceByRowId(progressionRowId: string) {
  const { data } = await supabase
    .from("sequences")
    .select("id")
    .eq("progression_row_id", progressionRowId)
    .maybeSingle();

  return data?.id ?? null;
}
