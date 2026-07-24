import type { ProgrammingCellContent, ProgrammingTable } from "@/lib/programming/types";
import {
  getModuleSummariesForTable,
  summarizeModulesByPeriod,
} from "@/lib/programming/module-summaries";
import type { ProgrammationModuleSummary } from "@/lib/programming/types";
import { sortModulesByMethod } from "./method-orders";
import type { LearningItem, ProgressionContext } from "./types";

function slug(value: string, index: number): string {
  return `${value.toLowerCase().replace(/\s+/g, "-")}-${index}`;
}

function matchLibraryResourceIds(
  summary: ProgrammationModuleSummary,
  context?: ProgressionContext,
): string[] {
  if (!context?.resources.length) return [];

  const moduleKey = summary.label.toLowerCase();
  const matched = context.resources.filter((resource) =>
    resource.modules.some(
      (moduleLabel) =>
        moduleLabel.toLowerCase().includes(moduleKey) ||
        moduleKey.includes(moduleLabel.toLowerCase()),
    ),
  );

  if (matched.length > 0) {
    return matched.map((resource) => resource.documentId);
  }

  const byMethode = context.resources.filter((resource) =>
    resource.matiere.toLowerCase().includes(context.programmation.programmation.matiere.toLowerCase()),
  );

  return byMethode.slice(0, 1).map((resource) => resource.documentId);
}

function buildPathFromSummaries(
  summaries: ProgrammationModuleSummary[],
  methode: string,
  context?: ProgressionContext,
): LearningItem[] {
  const orderedLabels = sortModulesByMethod(
    summaries.map((summary) => summary.label),
    methode,
  );
  const orderedSummaries = orderedLabels
    .map((label) => summaries.find((summary) => summary.label === label))
    .filter((summary): summary is ProgrammationModuleSummary => Boolean(summary));

  const items: LearningItem[] = [];
  let order = 0;

  for (const summary of orderedSummaries) {
    const resourceIds = matchLibraryResourceIds(summary, context);

    for (let sessionIndex = 0; sessionIndex < summary.sessionCount; sessionIndex += 1) {
      const seanceLabel =
        summary.seanceLabels?.[sessionIndex] ?? `Séance ${sessionIndex + 1}`;

      items.push({
        id: slug(`${summary.label}-${seanceLabel}`, order),
        type: "seance",
        label: seanceLabel,
        moduleLabel: summary.label,
        resourceIds,
        order: order++,
        metadata: {
          moduleSummaryId: summary.id,
          seanceIndex: sessionIndex + 1,
          sessionCount: summary.sessionCount,
          objectifs: summary.objectifs,
          competences: summary.competences,
          sourceDocumentId: summary.sourceDocumentId,
          sourcePath: summary.sourcePath
            ? `${summary.sourcePath} > ${seanceLabel}`
            : undefined,
          startWeek: summary.startWeek,
          periodNumber: summary.periodNumber,
        },
      });
    }
  }

  return items;
}

/**
 * Construit le parcours d'apprentissage à partir d'une cellule de programmation.
 */
export class LearningPathEngine {
  buildPath(
    cell: ProgrammingCellContent,
    methode: string,
    context?: ProgressionContext,
  ): LearningItem[] {
    const orderedModules = sortModulesByMethod(cell.modules, methode);
    const items: LearningItem[] = [];
    let order = 0;

    orderedModules.forEach((module) => {
      items.push({
        id: slug(`module-${module}`, order),
        type: "module",
        label: module,
        order: order++,
      });
    });

    cell.competences.forEach((competence) => {
      const referentiel = context?.referentiel.find((item) =>
        item.competence.toLowerCase() === competence.toLowerCase(),
      );

      items.push({
        id: slug(`competence-${competence}`, order),
        type: "competence",
        label: competence,
        referentielId: referentiel?.id,
        order: order++,
        prerequisiteIds: referentiel?.code ? [`code:${referentiel.code}`] : [],
      });
    });

    cell.notions.forEach((notion) => {
      items.push({
        id: slug(`notion-${notion}`, order),
        type: "notion",
        label: notion,
        order: order++,
      });
    });

    if (cell.content.trim()) {
      items.push({
        id: slug(`objectif-${cell.content}`, order),
        type: "objectif",
        label: cell.content,
        order: order++,
      });
    }

    return items;
  }

  buildPathsForTable(
    table: ProgrammingTable,
    methode: string,
    context?: ProgressionContext,
  ): Map<number, LearningItem[]> {
    const summaries = getModuleSummariesForTable(
      table,
      context?.programmation.programmation.metadata,
    );

    if (summaries.length > 0) {
      const byPeriod = summarizeModulesByPeriod(summaries);
      const map = new Map<number, LearningItem[]>();

      byPeriod.forEach((periodSummaries, periodNumber) => {
        map.set(periodNumber, buildPathFromSummaries(periodSummaries, methode, context));
      });

      return map;
    }

    const map = new Map<number, LearningItem[]>();

    table.periods.forEach((period) => {
      map.set(
        period.periodNumber,
        this.buildPath(period.cell, methode, context),
      );
    });

    return map;
  }
}

export const learningPathEngine = new LearningPathEngine();
