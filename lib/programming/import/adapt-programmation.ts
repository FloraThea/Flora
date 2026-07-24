import type { FloraAccent } from "@/lib/theme";
import type {
  CalendarSnapshot,
  ProgrammingCellContent,
  ProgrammingTable,
} from "../types";
import {
  attachModuleSummariesToTables,
  buildModuleSummariesFromRows,
} from "../module-summaries";
import type {
  AdaptationPlan,
  AdaptationStrategy,
  ImportedProgrammationRow,
} from "./types";

function emptyCell(): ProgrammingCellContent {
  return {
    competences: [],
    notions: [],
    resources: [],
    guides: [],
    modules: [],
    content: "",
  };
}

function cellFromRow(row: ImportedProgrammationRow): ProgrammingCellContent {
  const parts = [
    row.seance,
    row.objectif,
    row.deroulement,
    row.remarques,
    row.evaluation,
    row.differenciation,
  ].filter(Boolean);

  return {
    competences: row.competences,
    notions: row.notions,
    resources: row.ressources,
    guides: [],
    modules: row.sequence ? [row.sequence] : [],
    content: parts.join("\n"),
    metadata: {
      discipline: row.discipline,
      domaine: row.domaine,
      materiel: row.materiel,
      importedRowId: row.id,
    },
  };
}

function mergeCells(a: ProgrammingCellContent, b: ProgrammingCellContent): ProgrammingCellContent {
  return {
    competences: [...new Set([...a.competences, ...b.competences])],
    notions: [...new Set([...a.notions, ...b.notions])],
    resources: [...new Set([...a.resources, ...b.resources])],
    guides: [...new Set([...a.guides, ...b.guides])],
    modules: [...new Set([...a.modules, ...b.modules])],
    content: [a.content, b.content].filter(Boolean).join("\n---\n"),
    metadata: { ...a.metadata, ...b.metadata },
  };
}

function chooseStrategy(sourceCount: number, targetCount: number): AdaptationStrategy {
  if (sourceCount === targetCount) return "spread";
  if (sourceCount > targetCount) return "condense";
  if (sourceCount < targetCount * 0.85) return "add_revision";
  return "spread";
}

export function buildAdaptationPlan(
  rows: ImportedProgrammationRow[],
  calendar: CalendarSnapshot,
): AdaptationPlan {
  const sourceWeekCount = rows.length;
  const targetWeekCount = calendar.totalClassWeeks;
  const strategy = chooseStrategy(sourceWeekCount, targetWeekCount);
  const strategiesApplied: AdaptationStrategy[] = [strategy];
  const conflicts: AdaptationPlan["conflicts"] = [];
  const suggestions: string[] = [];

  if (sourceWeekCount > targetCountWithBuffer(targetWeekCount)) {
    strategiesApplied.push("merge");
    suggestions.push("Fusion de séances proches pour tenir dans les 36 semaines de classe.");
    conflicts.push({
      code: "too_many_weeks",
      severity: "warning",
      message: `${sourceWeekCount} séances importées pour ${targetWeekCount} semaines disponibles.`,
    });
  }

  if (sourceWeekCount < targetWeekCount * 0.7) {
    strategiesApplied.push("add_revision");
    suggestions.push("Ajout de semaines de révision ou d'approfondissement suggéré.");
    conflicts.push({
      code: "too_few_weeks",
      severity: "warning",
      message: `Seulement ${sourceWeekCount} séances pour ${targetWeekCount} semaines.`,
    });
  }

  if (Math.abs(sourceWeekCount - targetWeekCount) > 3 && sourceWeekCount < targetWeekCount) {
    strategiesApplied.push("shift");
    suggestions.push("Étalement automatique sur les semaines disponibles.");
  }

  return {
    sourceWeekCount,
    targetWeekCount,
    strategy,
    strategiesApplied: [...new Set(strategiesApplied)],
    conflicts,
    suggestions,
  };
}

function targetCountWithBuffer(target: number): number {
  return Math.round(target * 1.05);
}

export function adaptRowsToCalendar(input: {
  rows: ImportedProgrammationRow[];
  calendar: CalendarSnapshot;
  matiere: string;
  discipline: string;
  accent?: FloraAccent;
}): { tables: ProgrammingTable[]; plan: AdaptationPlan } {
  const plan = buildAdaptationPlan(input.rows, input.calendar);
  const slots = input.calendar.schoolWeeks;
  const distributed = distributeRows(input.rows, slots.length, plan.strategy);

  const weekCells = new Map<number, ProgrammingCellContent>();
  for (let index = 0; index < slots.length; index += 1) {
    const row = distributed[index];
    if (!row) continue;
    const existing = weekCells.get(index);
    weekCells.set(index, existing ? mergeCells(existing, cellFromRow(row)) : cellFromRow(row));
  }

  const discipline = input.discipline || input.matiere || "Programmation importée";
  const table: ProgrammingTable = {
    subjectKey: discipline.toLowerCase().replace(/\s+/g, "_"),
    subjectLabel: discipline,
    subSubjectLabel: "",
    accent: input.accent ?? "sage",
    sortOrder: 0,
    periods: input.calendar.periods.map((period) => {
      const periodWeeks = period.schoolWeeks;
      let mergedCell = emptyCell();

      for (const week of periodWeeks) {
        const slotIndex = input.calendar.schoolWeeks.findIndex(
          (item) => item.weekNumberInYear === week.weekNumberInYear,
        );
        const cell = weekCells.get(slotIndex);
        if (cell) mergedCell = mergeCells(mergedCell, cell);
      }

      return {
        periodNumber: period.periodNumber,
        label: period.label,
        weekCount: period.classWeeks,
        startDate: period.startDate,
        endDate: period.endDate,
        cell: mergedCell,
      };
    }),
  };

  const moduleSummaries = buildModuleSummariesFromRows(input.rows);
  const tables =
    moduleSummaries.length > 0
      ? attachModuleSummariesToTables([table], moduleSummaries)
      : [table];

  return { tables, plan };
}

function distributeRows(
  rows: ImportedProgrammationRow[],
  targetSlots: number,
  strategy: AdaptationStrategy,
): Array<ImportedProgrammationRow | null> {
  if (rows.length === 0 || targetSlots === 0) {
    return Array.from({ length: targetSlots }, () => null);
  }

  const result: Array<ImportedProgrammationRow | null> = Array.from(
    { length: targetSlots },
    () => null,
  );

  if (strategy === "condense" || rows.length > targetSlots) {
    const ratio = rows.length / targetSlots;
    for (let slot = 0; slot < targetSlots; slot += 1) {
      const sourceIndex = Math.min(rows.length - 1, Math.floor(slot * ratio));
      result[slot] = rows[sourceIndex];
    }
    return result;
  }

  if (strategy === "add_revision" && rows.length < targetSlots) {
    const ratio = targetSlots / rows.length;
    for (let index = 0; index < rows.length; index += 1) {
      const slot = Math.min(targetSlots - 1, Math.floor(index * ratio));
      result[slot] = rows[index];
    }
    return result;
  }

  const ratio = targetSlots / rows.length;
  for (let index = 0; index < rows.length; index += 1) {
    const slot = Math.min(targetSlots - 1, Math.round(index * ratio));
    if (!result[slot]) {
      result[slot] = rows[index];
    }
  }

  return result;
}
