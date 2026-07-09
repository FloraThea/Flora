import type { ProgrammingCellContent, ProgrammingTable } from "@/lib/programming/types";
import { sortModulesByMethod } from "./method-orders";
import type { LearningItem, ProgressionContext } from "./types";

function slug(value: string, index: number): string {
  return `${value.toLowerCase().replace(/\s+/g, "-")}-${index}`;
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

    cell.competences.forEach((competence, index) => {
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
      void index;
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
