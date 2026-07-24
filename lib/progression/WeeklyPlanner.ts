import type { ProgrammingTable } from "@/lib/programming/types";
import type { LearningItem, ProgressionContext, ProgressionRowDraft, WeeklySlot } from "./types";

function sessionsPerWeek(context: ProgressionContext, subjectLabel: string): number {
  const hours =
    context.timetable.weeklyHoursBySubject[subjectLabel] ??
    context.timetable.weeklyHoursBySubject["Français"] ??
    2;

  return Math.max(1, Math.round(hours));
}

function rowFromItem(input: {
  item: LearningItem;
  periodNumber: number;
  weekNumber: number;
  sessionNumber: number;
  table: ProgrammingTable;
  periodLabel: string;
  weekCount: number;
  context: ProgressionContext;
  currentModuleLabel: string;
}): ProgressionRowDraft {
  const { item, table, context, periodNumber, weekNumber, sessionNumber } = input;
  const metadata = item.metadata ?? {};
  const moduleLabel =
    item.moduleLabel ??
    (item.type === "module" ? item.label : input.currentModuleLabel) ??
    table.subSubjectLabel;

  const objectifs = Array.isArray(metadata.objectifs)
    ? (metadata.objectifs as string[])
    : item.type === "objectif"
      ? [item.label]
      : [];

  const competenceBo =
    item.type === "competence"
      ? item.label
      : Array.isArray(metadata.competences) && metadata.competences.length > 0
        ? String(metadata.competences[0])
        : "";

  const resourceIds =
    item.resourceIds && item.resourceIds.length > 0
      ? item.resourceIds
      : context.resources.slice(0, 3).map((resource) => resource.documentId);

  const period = table.periods.find((entry) => entry.periodNumber === periodNumber);

  return {
    periodNumber,
    weekNumber,
    sessionNumber,
    sequenceModule: moduleLabel || table.subjectLabel,
    seanceLabel: item.type === "seance" ? item.label : `Séance ${sessionNumber}`,
    competenceBo,
    objectifs,
    deroulement: period?.cell.content ?? "",
    materiel: period?.cell.guides ?? [],
    resources: [
      ...(period?.cell.resources ?? []),
      ...context.resources
        .filter((resource) =>
          resource.matiere.toLowerCase().includes(table.subjectLabel.toLowerCase()),
        )
        .slice(0, 2)
        .map((resource) => resource.title),
    ],
    remarques: "",
    commentaires: "",
    programmingTableId: table.id,
    programmingPeriodId: period?.id,
    programmingCellId: period?.cell.id,
    referentielIds: item.referentielId ? [item.referentielId] : [],
    resourceIds,
    learningItemId: item.id,
    metadata: {
      periodLabel: input.periodLabel,
      weekCount: input.weekCount,
      sourcePath: metadata.sourcePath,
      sourceDocumentId: metadata.sourceDocumentId,
      moduleSummaryId: metadata.moduleSummaryId,
      seanceIndex: metadata.seanceIndex,
      startWeek: metadata.startWeek,
    },
  };
}

/**
 * Répartit les apprentissages par période, semaine et séance.
 */
export class WeeklyPlanner {
  planTableRows(
    table: ProgrammingTable,
    learningPaths: Map<number, LearningItem[]>,
    context: ProgressionContext,
  ): ProgressionRowDraft[] {
    const rows: ProgressionRowDraft[] = [];
    const weeklySessions = sessionsPerWeek(context, table.subjectLabel);

    for (const period of table.periods) {
      const items = learningPaths.get(period.periodNumber) ?? [];
      if (items.length === 0 && !period.cell.content.trim()) continue;

      const weekCount = Math.max(1, Math.ceil(period.weekCount));
      let itemIndex = 0;
      let currentModuleLabel = table.subSubjectLabel;

      for (let weekNumber = 1; weekNumber <= weekCount; weekNumber += 1) {
        for (let sessionNumber = 1; sessionNumber <= weeklySessions; sessionNumber += 1) {
          const item = items[itemIndex];
          if (!item) break;

          if (item.type === "module") {
            currentModuleLabel = item.label;
          }
          if (item.moduleLabel) {
            currentModuleLabel = item.moduleLabel;
          }

          rows.push(
            rowFromItem({
              item,
              periodNumber: period.periodNumber,
              weekNumber,
              sessionNumber,
              table,
              periodLabel: period.label,
              weekCount: period.weekCount,
              context,
              currentModuleLabel,
            }),
          );

          itemIndex += 1;
        }
      }

      while (itemIndex < items.length) {
        const item = items[itemIndex];
        if (item.type === "module") {
          currentModuleLabel = item.label;
          itemIndex += 1;
          continue;
        }

        rows.push(
          rowFromItem({
            item,
            periodNumber: period.periodNumber,
            weekNumber: weekCount,
            sessionNumber: weeklySessions,
            table,
            periodLabel: period.label,
            weekCount: period.weekCount,
            context,
            currentModuleLabel,
          }),
        );
        itemIndex += 1;
      }
    }

    return rows;
  }

  listWeeklySlots(table: ProgrammingTable, context: ProgressionContext): WeeklySlot[] {
    const weeklySessions = sessionsPerWeek(context, table.subjectLabel);
    const slots: WeeklySlot[] = [];

    table.periods.forEach((period) => {
      const weekCount = Math.max(1, Math.ceil(period.weekCount));
      for (let weekNumber = 1; weekNumber <= weekCount; weekNumber += 1) {
        for (let sessionNumber = 1; sessionNumber <= weeklySessions; sessionNumber += 1) {
          slots.push({
            periodNumber: period.periodNumber,
            weekNumber,
            sessionNumber,
            periodLabel: period.label,
            weekCount: period.weekCount,
          });
        }
      }
    });

    return slots;
  }
}

export const weeklyPlanner = new WeeklyPlanner();
