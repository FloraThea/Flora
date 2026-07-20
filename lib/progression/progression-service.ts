import type { FloraAccent } from "@/lib/theme";
import { floraDb } from "@/lib/supabase/get-db";
import {
  isMissingSchemaColumnError,
  omitRecordKey,
  updateWithOptionalColumnFallback,
} from "@/lib/supabase/schema-compat";
import type { SourceDocument } from "@/lib/import/source-document";
import { resolveStoredSourceDocument } from "@/lib/import/source-document-service";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { logPedagogicalChange } from "@/lib/pedagogical/change-history";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import { resolveReferentielIds } from "@/lib/pedagogical/competence-resolver";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { getStorageBucketName } from "@/lib/supabase/storage-config";
import { onlyActive } from "@/lib/trash/active-query";
import type {
  ProgressionDeleteMode,
  ProgressionDependencies,
  ProgressionPayload,
  ProgressionRow,
  ProgressionTab,
  ProgressionValidationResult,
  StoredProgression,
} from "./types";


export async function saveProgression(input: {
  title: string;
  programmationId?: string | null;
  methode: string;
  calendarSnapshot: StoredProgression["calendar_snapshot"];
  validation: ProgressionValidationResult;
  tabs: ProgressionTab[];
  linkMode?: "linked" | "independent";
  matiere?: string;
  sousMatiere?: string;
  niveau?: string;
  periode?: string;
  importMeta?: {
    sourceType?: string;
    sourceFileName?: string;
    sourceStoragePath?: string;
    importFormat?: string;
    originalImport?: Record<string, unknown>;
    competencyMatches?: Record<string, unknown>;
    sourceDocument?: SourceDocument;
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
    status:
      input.importMeta?.sourceType === "imported"
        ? "validated"
        : input.validation.valid
          ? "validated"
          : "draft",
    link_mode: input.linkMode ?? (input.programmationId ? "linked" : "independent"),
    matiere: input.matiere ?? "",
    sous_matiere: input.sousMatiere ?? "",
    niveau: input.niveau ?? "",
    periode: input.periode ?? "",
    source_document: input.importMeta?.sourceDocument ?? {},
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

  async function insertProgression(row: typeof progressionRow) {
    return (await floraDb()).from("progressions").insert(row).select("*").single();
  }

  let insertRow: typeof progressionRow = progressionRow;
  let insertResult = await insertProgression(insertRow);

  for (const optionalColumn of [
    "source_document",
    "link_mode",
    "matiere",
    "sous_matiere",
    "niveau",
    "periode",
  ] as const) {
    if (isMissingSchemaColumnError(insertResult.error, optionalColumn)) {
      insertRow = omitRecordKey(insertRow, optionalColumn) as typeof progressionRow;
      insertResult = await insertProgression(insertRow);
    }
  }

  const { data: progression, error } = insertResult;

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
  const { data: progression, error } = await onlyActive(
    (await floraDb()).from("progressions").select("*").eq("id", id),
  ).single();

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
    sourceDocument: resolveStoredSourceDocument(progression),
    sourceType:
      (progression.metadata as Record<string, unknown> | undefined)?.source_type?.toString() ??
      undefined,
  };
}

export async function listProgressionsForProfile() {
  const scope = await requireTeacherScope();

  const { data, error } = await onlyActive(
    (await floraDb())
      .from("progressions")
      .select("id, title, methode, status, programmation_id, matiere, sous_matiere, niveau, periode, created_at, metadata")
      .eq("teacher_profile_id", scope.profileId),
  ).order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listValidatedProgressions() {
  const scope = await requireTeacherScope();

  const { data, error } = await onlyActive(
    (await floraDb())
      .from("progressions")
      .select("id, title, methode, status, programmation_id, matiere, sous_matiere, niveau, periode")
      .eq("teacher_profile_id", scope.profileId)
      .in("status", ["validated", "draft"]),
  ).order("created_at", { ascending: false });

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
      const { data: existingSequence } = await onlyActive(
        (await floraDb()).from("sequences").select("id").eq("progression_row_id", row.id),
      ).maybeSingle();

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

async function assertProgressionOwnership(progressionId: string) {
  const scope = await requireTeacherScope();

  const { data: progression, error } = await (await floraDb())
    .from("progressions")
    .select("id, teacher_profile_id, programmation_id, metadata")
    .eq("id", progressionId)
    .maybeSingle();

  if (error) throw error;

  if (!progression || progression.teacher_profile_id !== scope.profileId) {
    throw new Error("Progression introuvable.");
  }

  return { scope, progression };
}

async function listProgressionRowIds(progressionId: string): Promise<string[]> {
  const { data: rows, error } = await (await floraDb())
    .from("progression_rows")
    .select("id")
    .eq("progression_id", progressionId);

  if (error) throw error;
  return (rows ?? []).map((row) => String(row.id));
}

function slotDataReferencesProgression(
  slotData: unknown,
  progressionId: string,
  rowIds: Set<string>,
): boolean {
  if (!slotData || typeof slotData !== "object") return false;

  const data = slotData as Record<string, unknown>;
  if (data.progressionId === progressionId) return true;

  const rowId = data.progressionRowId;
  return typeof rowId === "string" && rowIds.has(rowId);
}

async function countJournalEntriesForProgression(
  profileId: string,
  progressionId: string,
  rowIds: string[],
): Promise<number> {
  const { data: journals, error: journalsError } = await (await floraDb())
    .from("journals")
    .select("id")
    .eq("teacher_profile_id", profileId);

  if (journalsError) throw journalsError;

  const journalIds = (journals ?? []).map((journal) => String(journal.id));
  if (journalIds.length === 0) return 0;

  const { data: entries, error: entriesError } = await (await floraDb())
    .from("journal_entries")
    .select("id, slot_data")
    .in("journal_id", journalIds);

  if (entriesError) throw entriesError;

  const rowIdSet = new Set(rowIds);
  return (entries ?? []).filter((entry) =>
    slotDataReferencesProgression(entry.slot_data, progressionId, rowIdSet),
  ).length;
}

async function clearJournalProgressionLinks(
  profileId: string,
  progressionId: string,
  rowIds: string[],
): Promise<void> {
  const { data: journals, error: journalsError } = await (await floraDb())
    .from("journals")
    .select("id")
    .eq("teacher_profile_id", profileId);

  if (journalsError) throw journalsError;

  const journalIds = (journals ?? []).map((journal) => String(journal.id));
  if (journalIds.length === 0) return;

  const { data: entries, error: entriesError } = await (await floraDb())
    .from("journal_entries")
    .select("id, slot_data")
    .in("journal_id", journalIds);

  if (entriesError) throw entriesError;

  const rowIdSet = new Set(rowIds);
  const db = await floraDb();

  for (const entry of entries ?? []) {
    if (!slotDataReferencesProgression(entry.slot_data, progressionId, rowIdSet)) continue;

    const slotData = { ...((entry.slot_data as Record<string, unknown>) ?? {}) };
    delete slotData.progressionId;
    delete slotData.progressionRowId;

    const { error } = await db
      .from("journal_entries")
      .update({ slot_data: slotData })
      .eq("id", entry.id);

    if (error) {
      throw new Error(
        getSupabaseErrorMessage(error, "Impossible de mettre à jour le cahier journal."),
      );
    }
  }
}

async function deleteProgressionAgendaEvents(profileId: string, rowIds: string[]): Promise<void> {
  if (rowIds.length === 0) return;

  const sourceIds = rowIds.map((rowId) => `progression_row:${rowId}`);
  const { error } = await (await floraDb())
    .from("agenda_events")
    .delete()
    .eq("teacher_profile_id", profileId)
    .eq("source_module", "progressions")
    .in("source_id", sourceIds);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de supprimer les événements liés."));
  }
}

async function unlinkSequencesFromProgression(
  progressionId: string,
  rowIds: string[],
): Promise<void> {
  const updateRow = {
    progression_id: null,
    progression_row_id: null,
    progression_tab_id: null,
    link_mode: "independent" as const,
    updated_at: new Date().toISOString(),
  };

  const db = await floraDb();
  const { error: byProgressionError } = await updateWithOptionalColumnFallback(
    async (row) => db.from("sequences").update(row).eq("progression_id", progressionId).select("id"),
    updateRow,
    "link_mode",
  );

  if (byProgressionError) {
    throw new Error(getSupabaseErrorMessage(byProgressionError, "Impossible de dissocier les séquences."));
  }

  if (rowIds.length === 0) return;

  const { error: byRowError } = await updateWithOptionalColumnFallback(
    async (row) => db.from("sequences").update(row).in("progression_row_id", rowIds).select("id"),
    updateRow,
    "link_mode",
  );

  if (byRowError) {
    throw new Error(getSupabaseErrorMessage(byRowError, "Impossible de dissocier les séquences."));
  }
}

async function unlinkSeancesFromProgression(
  progressionId: string,
  rowIds: string[],
): Promise<void> {
  const updateRow = {
    progression_id: null,
    progression_row_id: null,
    link_mode: "independent" as const,
    updated_at: new Date().toISOString(),
  };

  const db = await floraDb();
  const { error: byProgressionError } = await updateWithOptionalColumnFallback(
    async (row) => db.from("seances").update(row).eq("progression_id", progressionId).select("id"),
    updateRow,
    "link_mode",
  );

  if (byProgressionError) {
    throw new Error(getSupabaseErrorMessage(byProgressionError, "Impossible de dissocier les séances."));
  }

  if (rowIds.length === 0) return;

  const { error: byRowError } = await updateWithOptionalColumnFallback(
    async (row) => db.from("seances").update(row).in("progression_row_id", rowIds).select("id"),
    updateRow,
    "link_mode",
  );

  if (byRowError) {
    throw new Error(getSupabaseErrorMessage(byRowError, "Impossible de dissocier les séances."));
  }
}

async function deleteLinkedPedagogicalArtifacts(
  progressionId: string,
  rowIds: string[],
): Promise<void> {
  const db = await floraDb();

  const { error: seancesByProgressionError } = await db
    .from("seances")
    .delete()
    .eq("progression_id", progressionId);
  if (seancesByProgressionError) {
    throw new Error(
      getSupabaseErrorMessage(seancesByProgressionError, "Impossible de supprimer les séances liées."),
    );
  }

  if (rowIds.length > 0) {
    const { error: seancesByRowError } = await db.from("seances").delete().in("progression_row_id", rowIds);
    if (seancesByRowError) {
      throw new Error(
        getSupabaseErrorMessage(seancesByRowError, "Impossible de supprimer les séances liées."),
      );
    }
  }

  const { error: sequencesByProgressionError } = await db
    .from("sequences")
    .delete()
    .eq("progression_id", progressionId);
  if (sequencesByProgressionError) {
    throw new Error(
      getSupabaseErrorMessage(sequencesByProgressionError, "Impossible de supprimer les séquences liées."),
    );
  }

  if (rowIds.length > 0) {
    const { error: sequencesByRowError } = await db.from("sequences").delete().in("progression_row_id", rowIds);
    if (sequencesByRowError) {
      throw new Error(
        getSupabaseErrorMessage(sequencesByRowError, "Impossible de supprimer les séquences liées."),
      );
    }
  }
}

async function removeProgressionStorageFile(metadata: unknown): Promise<void> {
  if (!metadata || typeof metadata !== "object") return;

  const storagePath = String((metadata as Record<string, unknown>).source_storage_path ?? "").trim();
  if (!storagePath) return;

  const { error } = await (await floraDb()).storage.from(getStorageBucketName()).remove([storagePath]);

  if (error) {
    console.warn("[progression] Suppression fichier storage ignorée", {
      storagePath,
      error: getSupabaseErrorMessage(error, "Suppression storage échouée"),
    });
  }
}

export async function getProgressionDependencies(
  progressionId: string,
): Promise<ProgressionDependencies> {
  const { scope, progression } = await assertProgressionOwnership(progressionId);
  const rowIds = await listProgressionRowIds(progressionId);

  let programmation: ProgressionDependencies["programmation"] = null;

  if (progression.programmation_id) {
    const { data: linkedProgrammation } = await (await floraDb())
      .from("programmations")
      .select("id, title")
      .eq("id", progression.programmation_id)
      .maybeSingle();

    if (linkedProgrammation) {
      programmation = {
        id: String(linkedProgrammation.id),
        title: String(linkedProgrammation.title ?? ""),
      };
    }
  }

  const sequenceFilter =
    rowIds.length > 0
      ? `progression_id.eq.${progressionId},progression_row_id.in.(${rowIds.join(",")})`
      : `progression_id.eq.${progressionId}`;

  const { count: sequencesCount, error: sequencesError } = await (await floraDb())
    .from("sequences")
    .select("*", { count: "exact", head: true })
    .or(sequenceFilter);

  if (sequencesError) throw sequencesError;

  const seanceFilter =
    rowIds.length > 0
      ? `progression_id.eq.${progressionId},progression_row_id.in.(${rowIds.join(",")})`
      : `progression_id.eq.${progressionId}`;

  const { count: seancesCount, error: seancesError } = await (await floraDb())
    .from("seances")
    .select("*", { count: "exact", head: true })
    .or(seanceFilter);

  if (seancesError) throw seancesError;

  const journalEntries = await countJournalEntriesForProgression(
    scope.profileId,
    progressionId,
    rowIds,
  );

  let agendaEvents = 0;
  if (rowIds.length > 0) {
    const sourceIds = rowIds.map((rowId) => `progression_row:${rowId}`);
    const { count, error: agendaError } = await (await floraDb())
      .from("agenda_events")
      .select("*", { count: "exact", head: true })
      .eq("teacher_profile_id", scope.profileId)
      .eq("source_module", "progressions")
      .in("source_id", sourceIds);

    if (agendaError) throw agendaError;
    agendaEvents = count ?? 0;
  }

  const sequences = sequencesCount ?? 0;
  const seances = seancesCount ?? 0;
  const hasDependencies = sequences > 0 || seances > 0 || journalEntries > 0 || agendaEvents > 0;

  return {
    hasDependencies,
    programmation,
    sequences,
    seances,
    journalEntries,
    agendaEvents,
  };
}

export async function trashProgression(progressionId: string, reason?: string): Promise<void> {
  const { moveToTrash } = await import("@/lib/trash/trash-service");
  await moveToTrash({ entityType: "progression", id: progressionId, reason });
}

export async function deleteProgression(
  progressionId: string,
  mode: ProgressionDeleteMode,
): Promise<void> {
  const { scope, progression } = await assertProgressionOwnership(progressionId);
  const rowIds = await listProgressionRowIds(progressionId);
  const dependencies = await getProgressionDependencies(progressionId);

  if (dependencies.hasDependencies) {
    if (mode === "with_orphan_links") {
      await deleteLinkedPedagogicalArtifacts(progressionId, rowIds);
      await clearJournalProgressionLinks(scope.profileId, progressionId, rowIds);
      await deleteProgressionAgendaEvents(scope.profileId, rowIds);
    } else if (mode === "progression_only") {
      await unlinkSequencesFromProgression(progressionId, rowIds);
      await unlinkSeancesFromProgression(progressionId, rowIds);
      await clearJournalProgressionLinks(scope.profileId, progressionId, rowIds);
      await deleteProgressionAgendaEvents(scope.profileId, rowIds);
    } else {
      throw new Error("Cette progression est utilisée par d'autres éléments de Flora.");
    }
  }

  await removeProgressionStorageFile(progression.metadata);

  const { error } = await (await floraDb()).from("progressions").delete().eq("id", progressionId);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de supprimer la progression."));
  }
}

export async function updateProgressionSubject(
  progressionId: string,
  input: {
    matiere: string;
    sousMatiere?: string;
    niveau?: string;
    periode?: string;
    cascadeToLinked?: boolean;
  },
): Promise<void> {
  await assertProgressionOwnership(progressionId);

  const { error } = await (await floraDb())
    .from("progressions")
    .update({
      matiere: input.matiere,
      sous_matiere: input.sousMatiere ?? "",
      niveau: input.niveau ?? "",
      periode: input.periode ?? "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", progressionId);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de mettre à jour la matière."));
  }

  if (input.cascadeToLinked) {
    const db = await floraDb();
    await db
      .from("sequences")
      .update({
        matiere: input.matiere,
        sous_matiere: input.sousMatiere ?? "",
        niveau: input.niveau ?? "",
        updated_at: new Date().toISOString(),
      })
      .eq("progression_id", progressionId)
      .is("deleted_at", null);

    await db
      .from("seances")
      .update({
        matiere: input.matiere,
        sous_matiere: input.sousMatiere ?? "",
        niveau: input.niveau ?? "",
        updated_at: new Date().toISOString(),
      })
      .eq("progression_id", progressionId)
      .is("deleted_at", null);
  }
}
