import { runAgendaSync } from "@/lib/agenda/agenda-sync";
import { journalPropagationService } from "@/lib/journal/JournalPropagationService";
import { floraDb } from "@/lib/supabase/get-db";
import {
  getProgrammationIdForCell,
  propagateReferentielIdsToJournal,
  propagateReferentielIdsToProgressionRows,
  propagateReferentielIdsToSeances,
  syncCellReferentielIds,
} from "./competence-resolver";
import type { PedagogicalEvent, SyncScope } from "./types";

const DEFAULT_SCOPE: SyncScope = {
  journal: true,
  agenda: true,
  progression: true,
  seances: true,
  planner: false,
  stats: true,
  hours: true,
};

export async function handleProgrammationModified(
  event: Extract<PedagogicalEvent, { type: "programmation.modifiee" }>,
  scope: SyncScope = DEFAULT_SCOPE,
): Promise<{ progressionRows: number; journalEntries: number }> {
  let progressionRows = 0;
  let journalEntries = 0;

  if (scope.progression) {
    const { data: cell } = await (await floraDb())
      .from("programming_cells")
      .select("competences")
      .eq("id", event.cellId)
      .maybeSingle();

    const labels = (cell?.competences as string[]) ?? [];
    const referentielIds = await syncCellReferentielIds(event.cellId, labels);
    progressionRows = await propagateReferentielIdsToProgressionRows(
      event.cellId,
      referentielIds,
      labels,
    );

    if (scope.seances) {
      const { data: rows } = await (await floraDb())
        .from("progression_rows")
        .select("id")
        .eq("programming_cell_id", event.cellId);
      await propagateReferentielIdsToSeances(
        (rows ?? []).map((row) => String(row.id)),
        referentielIds,
        labels[0] ?? "",
      );
    }

    if (scope.journal) {
      journalEntries = await propagateReferentielIdsToJournal(referentielIds);
    }
  }

  if (scope.journal) {
    await journalPropagationService.syncFromProgrammation(event.programmationId);
  }

  if (scope.agenda) {
    await syncAgendaWindow();
  }

  return { progressionRows, journalEntries };
}

export async function handleProgressionModified(
  event: Extract<PedagogicalEvent, { type: "progression.modifiee" }>,
  scope: SyncScope = DEFAULT_SCOPE,
): Promise<number> {
  if (!scope.journal) return 0;

  const { data: row } = await (await floraDb())
    .from("progression_rows")
    .select("programmation_id, referentiel_ids, competence_bo")
    .eq("id", event.rowId)
    .maybeSingle();

  if (row?.referentiel_ids) {
    await propagateReferentielIdsToJournal(row.referentiel_ids as string[]);
  }

  if (row?.programmation_id) {
    return journalPropagationService.syncFromProgrammation(String(row.programmation_id));
  }

  return 0;
}

export async function handleProgressionCreated(
  event: Extract<PedagogicalEvent, { type: "progression.creee" }>,
  scope: SyncScope = DEFAULT_SCOPE,
): Promise<number> {
  if (!scope.journal) return 0;
  return journalPropagationService.syncFromProgrammation(event.programmationId);
}

export async function handleSeanceModified(
  event: Extract<PedagogicalEvent, { type: "seance.modifiee" | "seance.deplacee" }>,
  scope: SyncScope = DEFAULT_SCOPE,
): Promise<number> {
  let journalDays = 0;

  if (scope.journal) {
    journalDays = await journalPropagationService.syncFromSeance(event.seanceId);
  }

  if (scope.agenda) {
    await syncAgendaWindow();
  }

  return journalDays;
}

export async function handleTimetableModified(scope: SyncScope = DEFAULT_SCOPE): Promise<number> {
  if (!scope.journal) return 0;

  const days = await journalPropagationService.syncFromTimetableChange();

  if (scope.agenda) {
    await syncAgendaWindow();
  }

  return days;
}

export async function handleWeekMoved(
  event: Extract<PedagogicalEvent, { type: "semaine.deplacee" }>,
  scope: SyncScope = DEFAULT_SCOPE,
): Promise<void> {
  if (scope.agenda) {
    await syncAgendaWindow();
  }

  if (scope.journal && event.progressionId) {
    const { data: progression } = await (await floraDb())
      .from("progressions")
      .select("programmation_id")
      .eq("id", event.progressionId)
      .maybeSingle();

    if (progression?.programmation_id) {
      await journalPropagationService.syncFromProgrammation(String(progression.programmation_id));
    }
  }

  void event.fromWeekNumberInYear;
  void event.toWeekNumberInYear;
}

async function syncAgendaWindow(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setDate(end.getDate() + 90);
  const endDate = end.toISOString().slice(0, 10);

  await runAgendaSync(today, endDate);
}

export async function resolveProgrammationIdFromCell(cellId: string): Promise<string | null> {
  return getProgrammationIdForCell(cellId);
}
