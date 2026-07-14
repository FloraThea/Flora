import { supabase } from "@/lib/supabase";
import {
  buildIndependentSequenceDraft,
  resolveSequenceLinkMode,
} from "./independent-sequence-factory";
import type {
  IndependentSequenceCreateInput,
  SequenceDraft,
  SequenceEvaluation,
  SequenceLinkInput,
  SequencePayload,
  SequenceSession,
  StoredSequence,
} from "./types";

async function insertSequenceRecord(input: {
  draft: SequenceDraft;
  progressionId: string | null;
  progressionRowId: string | null;
  programmationId: string | null;
  progressionTabId?: string | null;
  linkMode: "linked" | "independent";
  metadata?: Record<string, unknown>;
}): Promise<SequencePayload> {
  const { data: sequence, error } = await supabase
    .from("sequences")
    .insert({
      progression_id: input.progressionId,
      progression_row_id: input.progressionRowId,
      programmation_id: input.programmationId,
      progression_tab_id: input.progressionTabId ?? null,
      link_mode: input.linkMode,
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
        ...input.metadata,
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

export async function saveSequence(input: {
  draft: SequenceDraft;
  progressionId: string;
  progressionRowId: string;
  programmationId: string;
  progressionTabId?: string;
}): Promise<SequencePayload> {
  return insertSequenceRecord({
    draft: input.draft,
    progressionId: input.progressionId,
    progressionRowId: input.progressionRowId,
    programmationId: input.programmationId,
    progressionTabId: input.progressionTabId ?? null,
    linkMode: "linked",
    metadata: { source_type: "generated" },
  });
}

export async function createIndependentSequence(
  input: IndependentSequenceCreateInput,
): Promise<SequencePayload> {
  if (!input.title?.trim()) {
    throw new Error("Le titre de la séquence est requis.");
  }
  if (!input.matiere?.trim()) {
    throw new Error("La matière est requise.");
  }

  const linkMode = resolveSequenceLinkMode(input);
  const draft = buildIndependentSequenceDraft(input);

  if (linkMode === "linked" && input.progressionRowId) {
    const { data: existing } = await supabase
      .from("sequences")
      .select("id")
      .eq("progression_row_id", input.progressionRowId)
      .maybeSingle();

    if (existing?.id) {
      throw new Error("Une séquence existe déjà pour cette ligne de progression.");
    }
  }

  return insertSequenceRecord({
    draft,
    progressionId: input.progressionId ?? null,
    progressionRowId: input.progressionRowId ?? null,
    programmationId: input.programmationId ?? null,
    linkMode,
    metadata: {
      source_type: linkMode === "independent" ? "manual_independent" : "manual_linked",
      created_independently: linkMode === "independent",
    },
  });
}

export async function linkSequenceToProgression(input: SequenceLinkInput): Promise<SequencePayload> {
  const { data: sequence, error } = await supabase
    .from("sequences")
    .update({
      progression_id: input.progressionId,
      progression_row_id: input.progressionRowId,
      programmation_id: input.programmationId ?? null,
      progression_tab_id: input.progressionTabId ?? null,
      link_mode: "linked",
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.sequenceId)
    .select("*")
    .single();

  if (error || !sequence) {
    throw error ?? new Error("Impossible d'associer la séquence.");
  }

  const payload = await loadSequence(input.sequenceId);
  if (!payload) throw new Error("Séquence introuvable après association.");
  return payload;
}

export async function dissociateSequence(sequenceId: string): Promise<SequencePayload> {
  const { error } = await supabase
    .from("sequences")
    .update({
      progression_id: null,
      progression_row_id: null,
      programmation_id: null,
      progression_tab_id: null,
      link_mode: "independent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sequenceId);

  if (error) throw error;

  const payload = await loadSequence(sequenceId);
  if (!payload) throw new Error("Séquence introuvable après dissociation.");
  return payload;
}

function mapStoredSequence(row: Record<string, unknown>): StoredSequence {
  return {
    id: String(row.id),
    progression_id: row.progression_id ? String(row.progression_id) : null,
    progression_row_id: row.progression_row_id ? String(row.progression_row_id) : null,
    programmation_id: row.programmation_id ? String(row.programmation_id) : null,
    progression_tab_id: row.progression_tab_id ? String(row.progression_tab_id) : null,
    link_mode: (row.link_mode as StoredSequence["link_mode"]) ?? "linked",
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
    .select("id, title, matiere, sous_matiere, period_number, week_numbers, session_count, progression_row_id, status, link_mode")
    .eq("progression_id", progressionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listIndependentSequences() {
  const { data, error } = await supabase
    .from("sequences")
    .select("id, title, matiere, sous_matiere, period_number, week_numbers, session_count, status, link_mode, created_at")
    .or("link_mode.eq.independent,progression_id.is.null")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    matiere: String(row.matiere ?? ""),
    sousMatiere: String(row.sous_matiere ?? ""),
    periodNumber: Number(row.period_number ?? 0),
    sessionCount: Number(row.session_count ?? 0),
    status: String(row.status ?? ""),
    linkMode: (row.link_mode as "linked" | "independent") ?? "independent",
  }));
}

export async function getSequenceByRowId(progressionRowId: string) {
  const { data } = await supabase
    .from("sequences")
    .select("id")
    .eq("progression_row_id", progressionRowId)
    .maybeSingle();

  return data?.id ?? null;
}
