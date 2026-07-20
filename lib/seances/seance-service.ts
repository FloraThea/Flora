import { floraDb } from "@/lib/supabase/get-db";
import {
  insertWithOptionalColumnFallback,
  updateWithOptionalColumnFallback,
} from "@/lib/supabase/schema-compat";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { onlyActive } from "@/lib/trash/active-query";
import {
  buildIndependentSeanceDraft,
  resolveSeanceLinkMode,
} from "./independent-seance-factory";
import type {
  IndependentSeanceCreateInput,
  SeanceActivity,
  SeanceDraft,
  SeanceEditAction,
  SeanceLinkInput,
  SeanceMaterial,
  SeancePayload,
  SeancePhase,
  SeanceUpdateInput,
  StoredSeance,
} from "./types";


function mapStoredSeance(row: Record<string, unknown>): StoredSeance {
  return {
    id: String(row.id),
    sequenceSessionId: row.sequence_session_id ? String(row.sequence_session_id) : null,
    sequenceId: row.sequence_id ? String(row.sequence_id) : null,
    progressionId: row.progression_id ? String(row.progression_id) : null,
    progressionRowId: row.progression_row_id ? String(row.progression_row_id) : null,
    programmationId: row.programmation_id ? String(row.programmation_id) : null,
    teacherProfileId: row.teacher_profile_id ? String(row.teacher_profile_id) : null,
    link_mode: (row.link_mode as StoredSeance["link_mode"]) ?? "linked",
    title: String(row.title ?? ""),
    matiere: String(row.matiere ?? ""),
    sousMatiere: String(row.sous_matiere ?? ""),
    niveau: String(row.niveau ?? ""),
    cycle: String(row.cycle ?? ""),
    periodNumber: Number(row.period_number ?? 0),
    weekNumber: Number(row.week_number ?? 0),
    sessionDate: row.session_date ? String(row.session_date) : null,
    dureeMinutes: Number(row.duree_minutes ?? 0),
    competenceBo: String(row.competence_bo ?? ""),
    objectif: String(row.objectif ?? ""),
    prerequis: (row.prerequis as string[]) ?? [],
    methode: String(row.methode ?? ""),
    resourceIds: (row.resource_ids as string[]) ?? [],
    referentielIds: (row.referentiel_ids as string[]) ?? [],
    resources: (row.resources as string[]) ?? [],
    materiel: (row.materiel as SeanceMaterial) ?? {
      guides: [],
      albums: [],
      affichages: [],
      manipulation: [],
      videoprojecteur: [],
      photocopies: [],
      fiches: [],
      cartes: [],
      jeux: [],
      autres: [],
    },
    differentiation: (row.differentiation as StoredSeance["differentiation"]) ?? {
      elevesFragiles: [],
      elevesAvances: [],
      groupesBesoins: [],
      adaptations: [],
      variantes: [],
    },
    evaluation: (row.evaluation as StoredSeance["evaluation"]) ?? {
      formative: "",
      criteresReussite: [],
      observables: [],
      remediations: [],
    },
    homework: (row.homework as StoredSeance["homework"]) ?? {
      devoirs: [],
      revisions: [],
      lecture: [],
      entrainement: [],
    },
    traceEcrite: (row.trace_ecrite as StoredSeance["traceEcrite"]) ?? {
      enseignant: "",
      eleve: "",
      lecon: "",
      aideMemoire: "",
    },
    pedagogicalChoices: (row.pedagogical_choices as string[]) ?? [],
    status: String(row.status ?? "validated"),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapPhase(row: Record<string, unknown>, activities: SeanceActivity[]): SeancePhase {
  return {
    id: String(row.id),
    phaseKey: row.phase_key as SeancePhase["phaseKey"],
    title: String(row.title ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    dureeMinutes: Number(row.duree_minutes ?? 0),
    summary: String(row.summary ?? ""),
    activities,
  };
}

function mapActivity(row: Record<string, unknown>): SeanceActivity {
  return {
    id: String(row.id),
    phaseId: String(row.phase_id),
    sortOrder: Number(row.sort_order ?? 0),
    objectif: String(row.objectif ?? ""),
    consignesEnseignant: String(row.consignes_enseignant ?? ""),
    consignesEleves: String(row.consignes_eleves ?? ""),
    organisation: String(row.organisation ?? ""),
    dureeMinutes: Number(row.duree_minutes ?? 0),
    variablesPedagogiques: (row.variables_pedagogiques as string[]) ?? [],
    questions: (row.questions as string[]) ?? [],
    reponsesAttendues: (row.reponses_attendues as string[]) ?? [],
    erreursFrequentes: (row.erreurs_frequentes as string[]) ?? [],
    remediations: (row.remediations as string[]) ?? [],
  };
}

async function recordHistory(input: {
  seanceId: string;
  entityType: string;
  entityId: string;
  fieldPath: string;
  previousValue: unknown;
  newValue: unknown;
}) {
  await (await floraDb()).from("seance_edit_history").insert({
    seance_id: input.seanceId,
    entity_type: input.entityType,
    entity_id: input.entityId,
    field_path: input.fieldPath,
    previous_value: input.previousValue as never,
    new_value: input.newValue as never,
  });
}

async function insertSeanceRecord(input: {
  draft: SeanceDraft;
  sequenceSessionId: string | null;
  sequenceId: string | null;
  progressionId: string | null;
  progressionRowId: string | null;
  programmationId: string | null;
  teacherProfileId?: string | null;
  linkMode: "linked" | "independent";
  metadata?: Record<string, unknown>;
}): Promise<SeancePayload> {
  const seanceRow = {
    sequence_session_id: input.sequenceSessionId,
    sequence_id: input.sequenceId,
    progression_id: input.progressionId,
    progression_row_id: input.progressionRowId,
    programmation_id: input.programmationId,
    teacher_profile_id: input.teacherProfileId ?? null,
    link_mode: input.linkMode,
    title: input.draft.title,
    matiere: input.draft.matiere,
    sous_matiere: input.draft.sousMatiere,
    niveau: input.draft.niveau,
    cycle: input.draft.cycle,
    period_number: input.draft.periodNumber,
    week_number: input.draft.weekNumber,
    session_date: input.draft.sessionDate,
    duree_minutes: input.draft.dureeMinutes,
    competence_bo: input.draft.competenceBo,
    objectif: input.draft.objectif,
    prerequis: input.draft.prerequis,
    methode: input.draft.methode,
    resource_ids: input.draft.resourceIds,
    referentiel_ids: input.draft.referentielIds,
    resources: input.draft.resources,
    materiel: input.draft.materiel,
    differentiation: input.draft.differentiation,
    evaluation: input.draft.evaluation,
    homework: input.draft.homework,
    trace_ecrite: input.draft.traceEcrite,
    pedagogical_choices: input.draft.pedagogicalChoices,
    status: "validated",
    metadata: {
      generated_at: new Date().toISOString(),
      ...input.metadata,
    },
  };

  const { data: seance, error } = await insertWithOptionalColumnFallback<
    typeof seanceRow,
    Record<string, unknown>
  >(
    async (row) => (await floraDb()).from("seances").insert(row).select("*").single(),
    seanceRow,
    "link_mode",
  );

  if (error || !seance) {
    throw error ?? new Error("Impossible d'enregistrer la séance.");
  }

  for (const phase of input.draft.phases) {
    const { data: phaseRow, error: phaseError } = await (await floraDb())
      .from("seance_phases")
      .insert({
        seance_id: seance.id,
        phase_key: phase.phaseKey,
        title: phase.title,
        sort_order: phase.sortOrder,
        duree_minutes: phase.dureeMinutes,
        summary: phase.summary,
      })
      .select("*")
      .single();

    if (phaseError || !phaseRow) throw phaseError;

    for (const activity of phase.activities) {
      const { error: activityError } = await (await floraDb()).from("seance_activities").insert({
        seance_id: seance.id,
        phase_id: phaseRow.id,
        sort_order: activity.sortOrder,
        objectif: activity.objectif,
        consignes_enseignant: activity.consignesEnseignant,
        consignes_eleves: activity.consignesEleves,
        organisation: activity.organisation,
        duree_minutes: activity.dureeMinutes,
        variables_pedagogiques: activity.variablesPedagogiques,
        questions: activity.questions,
        reponses_attendues: activity.reponsesAttendues,
        erreurs_frequentes: activity.erreursFrequentes,
        remediations: activity.remediations,
      });

      if (activityError) throw activityError;
    }
  }

  return loadSeance(String(seance.id)) as Promise<SeancePayload>;
}

export async function saveSeance(input: {
  draft: SeanceDraft;
  sequenceSessionId: string;
  sequenceId: string;
  progressionId: string | null;
  progressionRowId: string | null;
  programmationId: string | null;
  teacherProfileId?: string;
}): Promise<SeancePayload> {
  return insertSeanceRecord({
    draft: input.draft,
    sequenceSessionId: input.sequenceSessionId,
    sequenceId: input.sequenceId,
    progressionId: input.progressionId,
    progressionRowId: input.progressionRowId,
    programmationId: input.programmationId,
    teacherProfileId: input.teacherProfileId ?? null,
    linkMode: "linked",
    metadata: { source_type: "generated" },
  });
}

export async function createIndependentSeance(
  input: IndependentSeanceCreateInput,
): Promise<SeancePayload> {
  if (!input.title?.trim()) {
    throw new Error("Le titre de la séance est requis.");
  }
  if (!input.matiere?.trim()) {
    throw new Error("La matière est requise.");
  }

  const linkMode = resolveSeanceLinkMode(input);
  const draft = buildIndependentSeanceDraft(input);
  const scope = await requireTeacherScope();

  if (linkMode === "linked" && input.sequenceSessionId) {
    const { data: existing } = await (await floraDb())
      .from("seances")
      .select("id")
      .eq("sequence_session_id", input.sequenceSessionId)
      .maybeSingle();

    if (existing?.id) {
      throw new Error("Une séance existe déjà pour cette session de séquence.");
    }
  }

  return insertSeanceRecord({
    draft,
    sequenceSessionId: input.sequenceSessionId ?? null,
    sequenceId: input.sequenceId ?? null,
    progressionId: input.progressionId ?? null,
    progressionRowId: input.progressionRowId ?? null,
    programmationId: input.programmationId ?? null,
    teacherProfileId: input.teacherProfileId ?? scope.profileId,
    linkMode,
    metadata: {
      source_type: linkMode === "independent" ? "manual_independent" : "manual_linked",
      created_independently: linkMode === "independent",
    },
  });
}

export async function linkSeanceToSequence(input: SeanceLinkInput): Promise<SeancePayload> {
  const updateRow = {
    sequence_id: input.sequenceId,
    sequence_session_id: input.sequenceSessionId,
    progression_id: input.progressionId ?? null,
    progression_row_id: input.progressionRowId ?? null,
    programmation_id: input.programmationId ?? null,
    link_mode: "linked" as const,
    updated_at: new Date().toISOString(),
  };

  const { error } = await updateWithOptionalColumnFallback(
    async (row) => (await floraDb()).from("seances").update(row).eq("id", input.seanceId).select("id").single(),
    updateRow,
    "link_mode",
  );

  if (error) throw error;

  const payload = await loadSeance(input.seanceId);
  if (!payload) throw new Error("Séance introuvable après association.");
  return payload;
}

export async function dissociateSeance(seanceId: string): Promise<SeancePayload> {
  const updateRow = {
    sequence_id: null,
    sequence_session_id: null,
    progression_id: null,
    progression_row_id: null,
    programmation_id: null,
    link_mode: "independent" as const,
    updated_at: new Date().toISOString(),
  };

  const { error } = await updateWithOptionalColumnFallback(
    async (row) => (await floraDb()).from("seances").update(row).eq("id", seanceId).select("id").single(),
    updateRow,
    "link_mode",
  );

  if (error) throw error;

  const payload = await loadSeance(seanceId);
  if (!payload) throw new Error("Séance introuvable après dissociation.");
  return payload;
}

export async function listIndependentSeances() {
  const scope = await requireTeacherScope();

  const { data, error } = await onlyActive(
    (await floraDb())
      .from("seances")
      .select(
        "id, title, matiere, sous_matiere, niveau, period_number, week_number, session_date, duree_minutes, sequence_id, sequence_session_id, status, link_mode",
      )
      .eq("teacher_profile_id", scope.profileId)
      .or("link_mode.eq.independent,sequence_id.is.null"),
  ).order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    matiere: String(row.matiere ?? ""),
    sousMatiere: String(row.sous_matiere ?? ""),
    niveau: String(row.niveau ?? ""),
    periodNumber: Number(row.period_number ?? 0),
    weekNumber: Number(row.week_number ?? 0),
    sessionDate: row.session_date ? String(row.session_date) : null,
    dureeMinutes: Number(row.duree_minutes ?? 0),
    sequenceId: row.sequence_id ? String(row.sequence_id) : null,
    sequenceSessionId: row.sequence_session_id ? String(row.sequence_session_id) : null,
    sessionNumber: 0,
    status: String(row.status ?? ""),
    linkMode: (row.link_mode as "linked" | "independent") ?? "independent",
  }));
}

export async function loadSeance(id: string): Promise<SeancePayload | null> {
  const { data: seance, error } = await onlyActive(
    (await floraDb()).from("seances").select("*").eq("id", id),
  ).single();
  if (error || !seance) return null;

  const [{ data: phaseRows }, { data: activityRows }] = await Promise.all([
    (await floraDb()).from("seance_phases").select("*").eq("seance_id", id).order("sort_order"),
    (await floraDb()).from("seance_activities").select("*").eq("seance_id", id).order("sort_order"),
  ]);

  const activitiesByPhase = new Map<string, SeanceActivity[]>();
  for (const row of activityRows ?? []) {
    const activity = mapActivity(row);
    const list = activitiesByPhase.get(String(row.phase_id)) ?? [];
    list.push(activity);
    activitiesByPhase.set(String(row.phase_id), list);
  }

  const phases = (phaseRows ?? []).map((row) =>
    mapPhase(row, activitiesByPhase.get(String(row.id)) ?? []),
  );

  return {
    seance: mapStoredSeance(seance),
    phases,
  };
}

export async function listSeancesBySequence(sequenceId: string) {
  const { data, error } = await onlyActive(
    (await floraDb())
      .from("seances")
      .select(
        "id, title, matiere, sous_matiere, niveau, period_number, week_number, session_date, duree_minutes, sequence_id, sequence_session_id, status",
      )
      .eq("sequence_id", sequenceId),
  ).order("created_at");

  if (error) throw error;

  const sessionNumbers = new Map<string, number>();
  const { data: sessions } = await (await floraDb())
    .from("sequence_sessions")
    .select("id, session_number")
    .eq("sequence_id", sequenceId);

  for (const session of sessions ?? []) {
    sessionNumbers.set(String(session.id), Number(session.session_number));
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    matiere: String(row.matiere ?? ""),
    sousMatiere: String(row.sous_matiere ?? ""),
    niveau: String(row.niveau ?? ""),
    periodNumber: Number(row.period_number ?? 0),
    weekNumber: Number(row.week_number ?? 0),
    sessionDate: row.session_date ? String(row.session_date) : null,
    dureeMinutes: Number(row.duree_minutes ?? 0),
    sequenceId: row.sequence_id ? String(row.sequence_id) : null,
    sequenceSessionId: row.sequence_session_id ? String(row.sequence_session_id) : null,
    sessionNumber: sessionNumbers.get(String(row.sequence_session_id)) ?? 0,
    status: String(row.status ?? ""),
  }));
}

export async function listAllSeancesForProfile() {
  const scope = await requireTeacherScope();

  const { data, error } = await onlyActive(
    (await floraDb())
      .from("seances")
      .select(
        "id, title, matiere, sous_matiere, niveau, period_number, week_number, session_date, duree_minutes, status, link_mode, created_at, metadata",
      )
      .eq("teacher_profile_id", scope.profileId),
  ).order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function updateSeanceSubject(
  seanceId: string,
  input: {
    matiere: string;
    sousMatiere?: string;
    niveau?: string;
    periode?: string;
  },
): Promise<void> {
  const scope = await requireTeacherScope();

  const { data: existing, error: loadError } = await onlyActive(
    (await floraDb()).from("seances").select("id, teacher_profile_id").eq("id", seanceId),
  ).single();

  if (loadError || !existing || existing.teacher_profile_id !== scope.profileId) {
    throw new Error("Séance introuvable.");
  }

  const { error } = await (await floraDb())
    .from("seances")
    .update({
      matiere: input.matiere,
      sous_matiere: input.sousMatiere ?? "",
      niveau: input.niveau ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", seanceId);

  if (error) throw error;
}

export async function listSequencesWithSeances() {
  const { data: sequences, error } = await (await floraDb())
    .from("sequences")
    .select("id, title, matiere, sous_matiere, session_count, period_number, status")
    .eq("status", "validated")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const results = [];

  for (const sequence of sequences ?? []) {
    const { count } = await (await floraDb())
      .from("seances")
      .select("*", { count: "exact", head: true })
      .eq("sequence_id", sequence.id);

    results.push({
      id: String(sequence.id),
      title: String(sequence.title ?? ""),
      matiere: String(sequence.matiere ?? ""),
      sousMatiere: String(sequence.sous_matiere ?? ""),
      sessionCount: Number(sequence.session_count ?? 0),
      seanceCount: count ?? 0,
      periodNumber: Number(sequence.period_number ?? 0),
    });
  }

  return results;
}

export async function listSequenceSessions(sequenceId: string) {
  const { data: sequence } = await (await floraDb())
    .from("sequences")
    .select("title, matiere, sous_matiere, period_number, week_numbers")
    .eq("id", sequenceId)
    .single();

  const { data: sessions, error } = await (await floraDb())
    .from("sequence_sessions")
    .select("*")
    .eq("sequence_id", sequenceId)
    .order("session_number");

  if (error) throw error;

  const weekNumbers = (sequence?.week_numbers as number[]) ?? [];

  const results = [];

  for (const session of sessions ?? []) {
    const { data: seance } = await (await floraDb())
      .from("seances")
      .select("id")
      .eq("sequence_session_id", session.id)
      .maybeSingle();

    results.push({
      id: String(session.id),
      sequenceId,
      sequenceTitle: String(sequence?.title ?? ""),
      sessionNumber: Number(session.session_number),
      title: String(session.title ?? ""),
      objectif: String(session.objectif ?? ""),
      dureeMinutes: Number(session.duree_minutes ?? 0),
      matiere: String(sequence?.matiere ?? ""),
      sousMatiere: String(sequence?.sous_matiere ?? ""),
      periodNumber: Number(sequence?.period_number ?? 0),
      weekNumber: weekNumbers[0] ?? 0,
      hasSeance: Boolean(seance?.id),
      seanceId: seance?.id ? String(seance.id) : undefined,
    });
  }

  return results;
}

export async function getSeanceBySessionId(sequenceSessionId: string) {
  const { data } = await (await floraDb())
    .from("seances")
    .select("id")
    .eq("sequence_session_id", sequenceSessionId)
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}

const SEANCE_FIELD_MAP: Record<string, string> = {
  title: "title",
  objectif: "objectif",
  sessionDate: "session_date",
  traceEcrite: "trace_ecrite",
  evaluation: "evaluation",
  differentiation: "differentiation",
  homework: "homework",
  pedagogicalChoices: "pedagogical_choices",
};

const PHASE_FIELD_MAP: Record<string, string> = {
  title: "title",
  summary: "summary",
  dureeMinutes: "duree_minutes",
  sortOrder: "sort_order",
};

const ACTIVITY_FIELD_MAP: Record<string, string> = {
  objectif: "objectif",
  consignesEnseignant: "consignes_enseignant",
  consignesEleves: "consignes_eleves",
  organisation: "organisation",
  dureeMinutes: "duree_minutes",
  sortOrder: "sort_order",
  questions: "questions",
  reponsesAttendues: "reponses_attendues",
  erreursFrequentes: "erreurs_frequentes",
  remediations: "remediations",
  variablesPedagogiques: "variables_pedagogiques",
};

export async function updateSeanceField(input: SeanceUpdateInput): Promise<SeancePayload> {
  const current = await loadSeance(input.seanceId);
  if (!current) throw new Error("Séance introuvable.");

  if (input.entityType === "seance") {
    const column = SEANCE_FIELD_MAP[input.field];
    if (!column) throw new Error("Champ séance non modifiable.");

    const previousValue = (current.seance as Record<string, unknown>)[input.field];
    const { error } = await (await floraDb())
      .from("seances")
      .update({ [column]: input.value, updated_at: new Date().toISOString() })
      .eq("id", input.seanceId);

    if (error) throw error;

    await recordHistory({
      seanceId: input.seanceId,
      entityType: "seance",
      entityId: input.seanceId,
      fieldPath: input.field,
      previousValue,
      newValue: input.value,
    });
  }

  if (input.entityType === "phase") {
    const column = PHASE_FIELD_MAP[input.field];
    if (!column) throw new Error("Champ phase non modifiable.");

    const phase = current.phases.find((item) => item.id === input.entityId);
    const previousValue = phase ? (phase as Record<string, unknown>)[input.field] : null;

    const { error } = await (await floraDb())
      .from("seance_phases")
      .update({ [column]: input.value })
      .eq("id", input.entityId);

    if (error) throw error;

    await recordHistory({
      seanceId: input.seanceId,
      entityType: "phase",
      entityId: input.entityId,
      fieldPath: input.field,
      previousValue,
      newValue: input.value,
    });
  }

  if (input.entityType === "activity") {
    const column = ACTIVITY_FIELD_MAP[input.field];
    if (!column) throw new Error("Champ activité non modifiable.");

    let previousValue: unknown = null;
    for (const phase of current.phases) {
      const activity = phase.activities.find((item) => item.id === input.entityId);
      if (activity) {
        previousValue = (activity as Record<string, unknown>)[input.field];
        break;
      }
    }

    const { error } = await (await floraDb())
      .from("seance_activities")
      .update({ [column]: input.value })
      .eq("id", input.entityId);

    if (error) throw error;

    await recordHistory({
      seanceId: input.seanceId,
      entityType: "activity",
      entityId: input.entityId,
      fieldPath: input.field,
      previousValue,
      newValue: input.value,
    });
  }

  const payload = await loadSeance(input.seanceId);
  if (!payload) throw new Error("Impossible de recharger la séance.");
  return payload;
}

export async function applySeanceEditAction(action: SeanceEditAction): Promise<SeancePayload> {
  if (action.type === "duplicate_activity") {
    const payload = await loadSeance(action.seanceId);
    if (!payload) throw new Error("Séance introuvable.");

    let source: SeanceActivity | undefined;
    for (const phase of payload.phases) {
      source = phase.activities.find((item) => item.id === action.activityId);
      if (source) break;
    }
    if (!source || !source.phaseId) throw new Error("Activité introuvable.");

    const { error } = await (await floraDb()).from("seance_activities").insert({
      seance_id: action.seanceId,
      phase_id: source.phaseId,
      sort_order: source.sortOrder + 1,
      objectif: `${source.objectif} (copie)`,
      consignes_enseignant: source.consignesEnseignant,
      consignes_eleves: source.consignesEleves,
      organisation: source.organisation,
      duree_minutes: source.dureeMinutes,
      variables_pedagogiques: source.variablesPedagogiques,
      questions: source.questions,
      reponses_attendues: source.reponsesAttendues,
      erreurs_frequentes: source.erreursFrequentes,
      remediations: source.remediations,
    });

    if (error) throw error;
  }

  if (action.type === "move_activity") {
    const { error } = await (await floraDb())
      .from("seance_activities")
      .update({ phase_id: action.targetPhaseId, sort_order: action.targetSortOrder })
      .eq("id", action.activityId);

    if (error) throw error;
  }

  if (action.type === "merge_phases") {
    const payload = await loadSeance(action.seanceId);
    if (!payload) throw new Error("Séance introuvable.");

    const source = payload.phases.find((phase) => phase.id === action.sourcePhaseId);
    const target = payload.phases.find((phase) => phase.id === action.targetPhaseId);
    if (!source || !target) throw new Error("Phases introuvables.");

    await (await floraDb())
      .from("seance_activities")
      .update({ phase_id: action.targetPhaseId })
      .eq("phase_id", action.sourcePhaseId);

    await (await floraDb())
      .from("seance_phases")
      .update({
        summary: `${target.summary}\n\n${source.summary}`,
        duree_minutes: target.dureeMinutes + source.dureeMinutes,
      })
      .eq("id", action.targetPhaseId);

    await (await floraDb()).from("seance_phases").delete().eq("id", action.sourcePhaseId);
  }

  if (action.type === "split_phase") {
    const payload = await loadSeance(action.seanceId);
    if (!payload) throw new Error("Séance introuvable.");

    const source = payload.phases.find((phase) => phase.id === action.phaseId);
    if (!source) throw new Error("Phase introuvable.");

    const { data: newPhase, error } = await (await floraDb())
      .from("seance_phases")
      .insert({
        seance_id: action.seanceId,
        phase_key: `${source.phaseKey}_split`,
        title: `${source.title} (suite)`,
        sort_order: source.sortOrder + 1,
        duree_minutes: Math.round(source.dureeMinutes / 2),
        summary: source.summary,
      })
      .select("*")
      .single();

    if (error || !newPhase) throw error;

    await (await floraDb())
      .from("seance_activities")
      .update({ phase_id: newPhase.id })
      .in("id", action.activityIds);

    await (await floraDb())
      .from("seance_phases")
      .update({ duree_minutes: Math.round(source.dureeMinutes / 2) })
      .eq("id", action.phaseId);
  }

  const payload = await loadSeance(action.seanceId);
  if (!payload) throw new Error("Impossible de recharger la séance.");
  return payload;
}

export async function undoLastSeanceEdit(seanceId: string): Promise<SeancePayload | null> {
  const { data: history } = await (await floraDb())
    .from("seance_edit_history")
    .select("*")
    .eq("seance_id", seanceId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!history) return loadSeance(seanceId);

  const tableMap = {
    seance: "seances",
    phase: "seance_phases",
    activity: "seance_activities",
  } as const;

  const fieldMaps = {
    seance: SEANCE_FIELD_MAP,
    phase: PHASE_FIELD_MAP,
    activity: ACTIVITY_FIELD_MAP,
  } as const;

  const entityType = history.entity_type as keyof typeof tableMap;
  const table = tableMap[entityType];
  const fieldMap = fieldMaps[entityType];
  const column = fieldMap[history.field_path];

  if (table && column) {
    await (await floraDb())
      .from(table)
      .update({ [column]: history.previous_value })
      .eq("id", history.entity_id);
  }

  await (await floraDb()).from("seance_edit_history").delete().eq("id", history.id);

  return loadSeance(seanceId);
}
