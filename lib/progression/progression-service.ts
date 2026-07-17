import type { FloraAccent } from "@/lib/theme";
import { getDb } from "@/lib/supabase/get-db";
import { insertWithOptionalColumnFallback } from "@/lib/supabase/schema-compat";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { logPedagogicalChange } from "@/lib/pedagogical/change-history";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import { resolveReferentielIds } from "@/lib/pedagogical/competence-resolver";
import type {
  ProgressionPayload,
  ProgressionRow,
  ProgressionTab,
  ProgressionValidationResult,
  StoredProgression,
} from "./types";

async function floraDb() {
  return getDb();
}

export async function saveProgression(input: {
  title: string;
  programmationId?: string | null;
  methode: string;
  calendarSnapshot: StoredProgression["calendar_snapshot"];
  validation: ProgressionValidationResult;
  tabs: ProgressionTab[];
  linkMode?: "linked" | "independent";
  importMeta?: {
    sourceType?: string;
    sourceFileName?: string;
    sourceStoragePath?: string;
    importFormat?: string;
    originalImport?: Record<string, unknown>;
    competencyMatches?: Record<string, unknown>;
  };
}): Promise<ProgressionPayload> {
  const scope = await requireTeacherScope();

  const progressionRow = {
    teacher_profile_id: scope.profileId,
    programmation_id: input.programmationId ?? null,
    title: input.title,
    methode: input.methode,
    validation: input.validation,
    calendar_snapshot: input.calendarSnapshot,
    status: input.validation.valid ? "validated" : "draft",
    link_mode: input.linkMode ?? (input.programmationId ? "linked" : "independent"),
    metadata: {
      generated_at: new Date().toISOString(),
      source_type: input.importMeta?.sourceType ?? "generated",
      source_file_name: input.importMeta?.sourceFileName ?? "",
      source_storage_path: input.importMeta?.sourceStoragePath ?? "",
      import_format: input.importMeta?.importFormat ?? "",
      original_import: input.importMeta?.originalImport ?? {},
      competency_matches: input.importMeta?.competencyMatches ?? {},
      ...(input.importMeta?.sourceType === "imported"
        ? { imported_at: new Date().toISOString() }
        : {}),
    },
  };

  const { data: progression, error } = await insertWithOptionalColumnFallback<
    typeof progressionRow,
    StoredProgression
  >(
    async (row) => (await floraDb()).from("progressions").insert(row).select("*").single(),
    progressionRow,
    "link_mode",
  );

  if (error || !progression) {
    throw error ?? new Error("Impossible d'enregistrer la progression.");
  }

  const savedTabs: ProgressionTab[] = [];

  for (const tab of input.tabs) {
    const { data: savedTab, error: tabError } = await (await floraDb())
      .from("progression_tabs")
      .insert({
        progression_id: progression.id,
        programming_table_id: tab.programmingTableId ?? null,
        subject_key: tab.subjectKey,
        subject_label: tab.subjectLabel,
        sub_subject_label: tab.subSubjectLabel,
        sort_order: tab.sortOrder,
        accent: tab.accent,
      })
      .select("*")
      .single();

    if (tabError || !savedTab) {
      throw tabError ?? new Error("Impossible d'enregistrer un onglet.");
    }

    const rowPayloads = tab.rows.map((row, index) => ({
      progression_id: progression.id,
      tab_id: savedTab.id,
      programmation_id: input.programmationId ?? null,
      programming_table_id: row.programmingTableId ?? null,
      programming_period_id: row.programmingPeriodId ?? null,
      programming_cell_id: row.programmingCellId ?? null,
      referentiel_ids: row.referentielIds,
      resource_ids: row.resourceIds,
      period_number: row.periodNumber,
      week_number: row.weekNumber,
      session_number: row.sessionNumber,
      sequence_module: row.sequenceModule,
      seance_label: row.seanceLabel,
      competence_bo: row.competenceBo,
      objectifs: row.objectifs,
      deroulement: row.deroulement,
      materiel: row.materiel,
      resources: row.resources,
      remarques: row.remarques,
      commentaires: row.commentaires,
      sort_order: index,
      metadata: row.metadata ?? {},
    }));

    const { data: savedRows, error: rowsError } = await (await floraDb())
      .from("progression_rows")
      .insert(rowPayloads)
      .select("*");

    if (rowsError) {
      throw rowsError;
    }

    savedTabs.push({
      id: savedTab.id,
      programmingTableId: tab.programmingTableId,
      subjectKey: tab.subjectKey,
      subjectLabel: tab.subjectLabel,
      subSubjectLabel: tab.subSubjectLabel,
      accent: tab.accent as FloraAccent,
      sortOrder: tab.sortOrder,
      rows: (savedRows ?? []).map(
        (row): ProgressionRow => ({
          id: row.id,
          sortOrder: row.sort_order,
          periodNumber: row.period_number,
          weekNumber: row.week_number,
          sessionNumber: row.session_number,
          sequenceModule: row.sequence_module,
          seanceLabel: row.seance_label,
          competenceBo: row.competence_bo,
          objectifs: (row.objectifs as string[]) ?? [],
          deroulement: row.deroulement,
          materiel: (row.materiel as string[]) ?? [],
          resources: (row.resources as string[]) ?? [],
          remarques: row.remarques,
          commentaires: row.commentaires,
          programmingTableId: row.programming_table_id ?? undefined,
          programmingPeriodId: row.programming_period_id ?? undefined,
          programmingCellId: row.programming_cell_id ?? undefined,
          referentielIds: (row.referentiel_ids as string[]) ?? [],
          resourceIds: (row.resource_ids as string[]) ?? [],
          metadata: (row.metadata as Record<string, unknown>) ?? {},
        }),
      ),
    });
  }

  const { data: programmation } = input.programmationId
    ? await (await floraDb())
        .from("programmations")
        .select("*")
        .eq("id", input.programmationId)
        .single()
    : { data: null };

  return {
    progression: progression as StoredProgression,
    tabs: savedTabs,
    validation: input.validation,
    programmation: programmation as ProgressionPayload["programmation"],
  };
}

export async function saveProgressionWithSync(input: Parameters<typeof saveProgression>[0]) {
  const payload = await saveProgression(input);
  void pedagogicalEngine.emit({
    type: "progression.creee",
    progressionId: payload.progression.id,
    programmationId: input.programmationId ?? "",
  });
  return payload;
}

export async function updateProgressionRow(
  rowId: string,
  row: Pick<
    ProgressionRow,
    | "objectifs"
    | "deroulement"
    | "materiel"
    | "resources"
    | "remarques"
    | "commentaires"
    | "competenceBo"
    | "sequenceModule"
    | "seanceLabel"
    | "referentielIds"
  >,
): Promise<void> {
  const { data: previous } = await (await floraDb())
    .from("progression_rows")
    .select("competence_bo, referentiel_ids, progression_id")
    .eq("id", rowId)
    .maybeSingle();

  const referentielIds =
    row.referentielIds ??
    (row.competenceBo ? await resolveReferentielIds([row.competenceBo]) : []);

  const { error } = await (await floraDb())
    .from("progression_rows")
    .update({
      objectifs: row.objectifs,
      deroulement: row.deroulement,
      materiel: row.materiel,
      resources: row.resources,
      remarques: row.remarques,
      commentaires: row.commentaires,
      competence_bo: row.competenceBo,
      sequence_module: row.sequenceModule,
      seance_label: row.seanceLabel,
      referentiel_ids: referentielIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", rowId);

  if (error) throw error;

  await logPedagogicalChange({
    module: "progression",
    entityType: "progression_row",
    entityId: rowId,
    fieldName: "competence_bo",
    oldValue: previous?.competence_bo ?? "",
    newValue: row.competenceBo,
    eventType: "progression.modifiee",
  });

  void pedagogicalEngine.synchroniserProgression(
    rowId,
    previous?.progression_id ? String(previous.progression_id) : undefined,
  );
}

export async function loadProgression(id: string): Promise<ProgressionPayload | null> {
  const { data: progression, error } = await (await floraDb())
    .from("progressions")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !progression) return null;

  const { data: tabs } = await (await floraDb())
    .from("progression_tabs")
    .select("*")
    .eq("progression_id", id)
    .order("sort_order");

  const progressionTabs: ProgressionTab[] = [];

  for (const tab of tabs ?? []) {
    const { data: rows } = await (await floraDb())
      .from("progression_rows")
      .select("*")
      .eq("tab_id", tab.id)
      .order("sort_order");

    progressionTabs.push({
      id: tab.id,
      programmingTableId: tab.programming_table_id ?? undefined,
      subjectKey: tab.subject_key,
      subjectLabel: tab.subject_label,
      subSubjectLabel: tab.sub_subject_label,
      accent: tab.accent as FloraAccent,
      sortOrder: tab.sort_order,
      rows: (rows ?? []).map(
        (row): ProgressionRow => ({
          id: row.id,
          sortOrder: row.sort_order,
          periodNumber: row.period_number,
          weekNumber: row.week_number,
          sessionNumber: row.session_number,
          sequenceModule: row.sequence_module,
          seanceLabel: row.seance_label,
          competenceBo: row.competence_bo,
          objectifs: (row.objectifs as string[]) ?? [],
          deroulement: row.deroulement,
          materiel: (row.materiel as string[]) ?? [],
          resources: (row.resources as string[]) ?? [],
          remarques: row.remarques,
          commentaires: row.commentaires,
          programmingTableId: row.programming_table_id ?? undefined,
          programmingPeriodId: row.programming_period_id ?? undefined,
          programmingCellId: row.programming_cell_id ?? undefined,
          referentielIds: (row.referentiel_ids as string[]) ?? [],
          resourceIds: (row.resource_ids as string[]) ?? [],
          metadata: (row.metadata as Record<string, unknown>) ?? {},
        }),
      ),
    });
  }

  const { data: programmation } = progression.programmation_id
    ? await (await floraDb())
        .from("programmations")
        .select("*")
        .eq("id", progression.programmation_id)
        .single()
    : { data: null };

  return {
    progression: progression as StoredProgression,
    tabs: progressionTabs,
    validation: progression.validation as ProgressionValidationResult,
    programmation: programmation as ProgressionPayload["programmation"],
  };
}

export async function listValidatedProgressions() {
  const scope = await requireTeacherScope();

  const { data, error } = await (await floraDb())
    .from("progressions")
    .select("id, title, methode, status, programmation_id")
    .eq("teacher_profile_id", scope.profileId)
    .eq("status", "validated")
    .order("created_at", { ascending: false });

  if (error) throw error;

  const progressions = data ?? [];
  const enriched = await Promise.all(
    progressions.map(async (progression) => {
      const { count } = await (await floraDb())
        .from("progression_rows")
        .select("*", { count: "exact", head: true })
        .eq("progression_id", progression.id);

      return {
        ...progression,
        rowCount: count ?? 0,
      };
    }),
  );

  return enriched;
}

export async function listProgressionRows(progressionId: string) {
  const { data: tabs } = await (await floraDb())
    .from("progression_tabs")
    .select("id, subject_label, sub_subject_label")
    .eq("progression_id", progressionId)
    .order("sort_order");

  const rows = [];

  for (const tab of tabs ?? []) {
    const { data: tabRows } = await (await floraDb())
      .from("progression_rows")
      .select("id, period_number, week_number, seance_label, competence_bo, sequence_module")
      .eq("tab_id", tab.id)
      .order("sort_order");

    for (const row of tabRows ?? []) {
      const { data: existingSequence } = await (await floraDb())
        .from("sequences")
        .select("id")
        .eq("progression_row_id", row.id)
        .maybeSingle();

      rows.push({
        id: row.id,
        tabId: tab.id,
        subjectLabel: tab.subject_label,
        subSubjectLabel: tab.sub_subject_label,
        periodNumber: row.period_number,
        weekNumber: row.week_number,
        seanceLabel: row.seance_label,
        competenceBo: row.competence_bo,
        sequenceModule: row.sequence_module,
        hasSequence: Boolean(existingSequence),
      });
    }
  }

  return rows;
}
