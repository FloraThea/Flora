import type { ProgrammingTable } from "@/lib/programming/types";
import type { LearningItem, ProgressionContext, ProgressionRowDraft, WeeklySlot } from "./types";

function sessionsPerWeek(context: ProgressionContext, subjectLabel: string): number {
  const hours =
    context.timetable.weeklyHoursBySubject[subjectLabel] ??
    context.timetable.weeklyHoursBySubject["Français"] ??
    2;

  return Math.max(1, Math.round(hours));
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

      for (let weekNumber = 1; weekNumber <= weekCount; weekNumber += 1) {
        for (let sessionNumber = 1; sessionNumber <= weeklySessions; sessionNumber += 1) {
          const item = items[itemIndex];
          if (!item) break;

          const moduleLabel =
            period.cell.modules[itemIndex] ??
            table.subSubjectLabel ??
            period.cell.content;

          rows.push({
            periodNumber: period.periodNumber,
            weekNumber,
            sessionNumber,
            sequenceModule: item.type === "module" ? item.label : moduleLabel,
            seanceLabel: `Séance ${sessionNumber}`,
            competenceBo: item.type === "competence" ? item.label : period.cell.competences[0] ?? "",
            objectifs:
              item.type === "objectif"
                ? [item.label]
                : period.cell.notions.slice(0, 2),
            deroulement: period.cell.content,
            materiel: period.cell.guides,
            resources: [
              ...period.cell.resources,
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
            programmingPeriodId: period.id,
            programmingCellId: period.cell.id,
            referentielIds: item.referentielId ? [item.referentielId] : [],
            resourceIds: context.resources.slice(0, 3).map((resource) => resource.documentId),
            learningItemId: item.id,
            metadata: {
              periodLabel: period.label,
              weekCount: period.weekCount,
            },
          });

          itemIndex += 1;
        }
      }

      while (itemIndex < items.length) {
        const item = items[itemIndex];
        rows.push({
          periodNumber: period.periodNumber,
          weekNumber: weekCount,
          sessionNumber: weeklySessions,
          sequenceModule: item.type === "module" ? item.label : table.subSubjectLabel,
          seanceLabel: `Séance complémentaire`,
          competenceBo: item.type === "competence" ? item.label : "",
          objectifs: item.type === "notion" ? [item.label] : [],
          deroulement: period.cell.content,
          materiel: period.cell.guides,
          resources: period.cell.resources,
          remarques: "Complément de période",
          commentaires: "",
          programmingTableId: table.id,
          programmingPeriodId: period.id,
          programmingCellId: period.cell.id,
          referentielIds: item.referentielId ? [item.referentielId] : [],
          resourceIds: [],
          learningItemId: item.id,
          metadata: { overflow: true },
        });
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
