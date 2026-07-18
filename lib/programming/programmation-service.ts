import type { FloraAccent } from "@/lib/theme";
import { floraDb } from "@/lib/supabase/get-db";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import {
  getProgrammationIdForCell,
  syncCellReferentielIds,
} from "@/lib/pedagogical/competence-resolver";
import { logPedagogicalChange } from "@/lib/pedagogical/change-history";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import type {
  ProgrammationPayload,
  ProgrammingGenerationInput,
  ProgrammingTable,
  StoredProgrammation,
  ValidationResult,
} from "./types";


export async function saveProgrammation(input: {
  title: string;
  generationInput: ProgrammingGenerationInput;
  calendarSnapshot: ProgrammationPayload["programmation"]["calendar_snapshot"];
  validation: ValidationResult;
  tables: ProgrammingTable[];
  importMeta?: {
    sourceType?: string;
    sourceFileName?: string;
    sourceStoragePath?: string;
    discipline?: string;
    originalImport?: Record<string, unknown>;
    adaptedImport?: Record<string, unknown>;
    importAdaptation?: Record<string, unknown>;
    formatConfig?: Record<string, unknown>;
    competencyMatches?: Record<string, unknown>;
  };
}): Promise<ProgrammationPayload> {
  const scope = await requireTeacherScope();

  const { data: programmation, error } = await (await floraDb())
    .from("programmations")
    .insert({
      teacher_profile_id: scope.profileId,
      title: input.title,
      school_year: input.generationInput.schoolYear,
      academic_zone: input.generationInput.academicZone,
      levels: input.generationInput.levels,
      matiere: input.generationInput.matiere,
      methode: input.generationInput.methode,
      projet_annuel: input.generationInput.projetAnnuel,
      timetable: input.generationInput.timetable,
      calendar_snapshot: input.calendarSnapshot,
      validation: input.validation,
      status:
        input.importMeta?.sourceType === "imported"
          ? "validated"
          : input.validation.valid
            ? "validated"
            : "draft",
      source_type: input.importMeta?.sourceType ?? "generated",
      source_file_name: input.importMeta?.sourceFileName ?? "",
      source_storage_path: input.importMeta?.sourceStoragePath ?? "",
      discipline: input.importMeta?.discipline ?? input.generationInput.matiere,
      original_import: input.importMeta?.originalImport ?? {},
      adapted_import: input.importMeta?.adaptedImport ?? {},
      import_adaptation: input.importMeta?.importAdaptation ?? {},
      format_config: input.importMeta?.formatConfig ?? {},
      competency_matches: input.importMeta?.competencyMatches ?? {},
      metadata: {
        generated_at: new Date().toISOString(),
        ...(input.importMeta?.sourceType === "imported"
          ? { imported_at: new Date().toISOString() }
          : {}),
      },
    })
    .select("*")
    .single();

  if (error || !programmation) {
    throw error ?? new Error("Impossible d'enregistrer la programmation.");
  }

  const savedTables: ProgrammingTable[] = [];

  for (const table of input.tables) {
    const { data: savedTable, error: tableError } = await (await floraDb())
      .from("programming_tables")
      .insert({
        programmation_id: programmation.id,
        subject_key: table.subjectKey,
        subject_label: table.subjectLabel,
        sub_subject_label: table.subSubjectLabel,
        sort_order: table.sortOrder,
        accent: table.accent,
      })
      .select("*")
      .single();

    if (tableError || !savedTable) {
      throw tableError ?? new Error("Impossible d'enregistrer un tableau.");
    }

    const savedPeriods = [];

    for (const period of table.periods) {
      const { data: savedPeriod, error: periodError } = await (await floraDb())
        .from("programming_periods")
        .insert({
          table_id: savedTable.id,
          period_number: period.periodNumber,
          week_count: period.weekCount,
          start_date: period.startDate,
          end_date: period.endDate,
          label: period.label,
        })
        .select("*")
        .single();

      if (periodError || !savedPeriod) {
        throw periodError ?? new Error("Impossible d'enregistrer une période.");
      }

      const { data: savedCell, error: cellError } = await (await floraDb())
        .from("programming_cells")
        .insert({
          table_id: savedTable.id,
          period_id: savedPeriod.id,
          competences: period.cell.competences,
          notions: period.cell.notions,
          resources: period.cell.resources,
          guides: period.cell.guides,
          modules: period.cell.modules,
          content: period.cell.content,
        })
        .select("*")
        .single();

      if (cellError || !savedCell) {
        throw cellError ?? new Error("Impossible d'enregistrer une cellule.");
      }

      savedPeriods.push({
        ...period,
        id: savedPeriod.id,
        cell: {
          ...period.cell,
          id: savedCell.id,
        },
      });
    }

    savedTables.push({
      ...table,
      id: savedTable.id,
      periods: savedPeriods,
    });
  }

  return {
    programmation: programmation as StoredProgrammation,
    tables: savedTables,
    validation: input.validation,
  };
}

export async function updateProgrammingCell(
  cellId: string,
  cell: ProgrammingTable["periods"][number]["cell"],
): Promise<void> {
  const { data: previous } = await (await floraDb())
    .from("programming_cells")
    .select("competences, content, modules")
    .eq("id", cellId)
    .maybeSingle();

  const referentielIds = await syncCellReferentielIds(cellId, cell.competences);

  const { error } = await (await floraDb())
    .from("programming_cells")
    .update({
      competences: cell.competences,
      notions: cell.notions,
      resources: cell.resources,
      guides: cell.guides,
      modules: cell.modules,
      content: cell.content,
      referentiel_ids: referentielIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cellId);

  if (error) throw error;

  const programmationId = await getProgrammationIdForCell(cellId);

  await logPedagogicalChange({
    module: "programmation",
    entityType: "programming_cell",
    entityId: cellId,
    fieldName: "competences",
    oldValue: previous?.competences ?? [],
    newValue: cell.competences,
    eventType: "programmation.modifiee",
  });

  if (programmationId) {
    void pedagogicalEngine.synchroniserProgrammation(cellId, programmationId);
  }
}

export async function loadProgrammation(id: string): Promise<ProgrammationPayload | null> {
  const { data: programmation, error } = await (await floraDb())
    .from("programmations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !programmation) return null;

  const { data: tables } = await (await floraDb())
    .from("programming_tables")
    .select("*")
    .eq("programmation_id", id)
    .order("sort_order");

  const programmingTables: ProgrammingTable[] = [];

  for (const table of tables ?? []) {
    const { data: periods } = await (await floraDb())
      .from("programming_periods")
      .select("*")
      .eq("table_id", table.id)
      .order("period_number");

    const periodColumns = [];

    for (const period of periods ?? []) {
      const { data: cell } = await (await floraDb())
        .from("programming_cells")
        .select("*")
        .eq("period_id", period.id)
        .maybeSingle();

      periodColumns.push({
        id: period.id,
        periodNumber: period.period_number,
        label: period.label,
        weekCount: Number(period.week_count),
        startDate: period.start_date,
        endDate: period.end_date,
        cell: {
          id: cell?.id,
          competences: (cell?.competences as string[]) ?? [],
          notions: (cell?.notions as string[]) ?? [],
          resources: (cell?.resources as string[]) ?? [],
          guides: (cell?.guides as string[]) ?? [],
          modules: (cell?.modules as string[]) ?? [],
          content: cell?.content ?? "",
        },
      });
    }

    programmingTables.push({
      id: table.id,
      subjectKey: table.subject_key,
      subjectLabel: table.subject_label,
      subSubjectLabel: table.sub_subject_label,
      accent: table.accent as FloraAccent,
      sortOrder: table.sort_order,
      periods: periodColumns,
    });
  }

  return {
    programmation: programmation as StoredProgrammation,
    tables: programmingTables,
    validation: programmation.validation as ValidationResult,
  };
}

export async function listProgrammationsForProfile() {
  const scope = await requireTeacherScope();

  const { data, error } = await (await floraDb())
    .from("programmations")
    .select("id, title, school_year, matiere, methode, levels, status, created_at")
    .eq("teacher_profile_id", scope.profileId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listValidatedProgrammations() {
  const scope = await requireTeacherScope();

  const { data, error } = await (await floraDb())
    .from("programmations")
    .select("id, title, school_year, matiere, methode, levels, status")
    .eq("teacher_profile_id", scope.profileId)
    .in("status", ["validated", "draft"])
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}
