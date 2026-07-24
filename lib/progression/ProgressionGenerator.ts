import { askThea } from "@/lib/thea/services/gemini";
import {
  buildTheaInstructionBlock,
  getPrimaryMethod,
  loadTeacherProfileForGeneration,
} from "@/lib/profile";
import { loadProgrammation } from "@/lib/programming/programmation-service";
import { inferCycleFromLevels } from "@/lib/referentiel/bo-cycle-utils";
import { loadReferentielCompetences } from "@/lib/referentiel/referentiel-service";
import type { ReferentielCompetence } from "@/lib/programming/types";
import { loadLibraryResourcesForGeneration } from "@/lib/pedagogical/library-context";
import { competenceSequencer } from "./CompetenceSequencer";
import { learningPathEngine } from "./LearningPathEngine";
import { buildProgressionPrompt, parseProgressionEnrichment } from "./prompts/generateProgression";
import type {
  ProgressionContext,
  ProgressionGenerationInput,
  ProgressionTab,
} from "./types";
import { weeklyPlanner } from "./WeeklyPlanner";

async function loadReferentiel(
  levels: string[],
  matiere: string,
): Promise<ReferentielCompetence[]> {
  return loadReferentielCompetences({
    levels,
    matiere,
    cycle: inferCycleFromLevels(levels),
    label: "progression",
    requireBoDocument: true,
  });
}

async function loadResources(methode: string, matiere?: string) {
  return loadLibraryResourcesForGeneration({ methode, matiere });
}

/**
 * Génère une progression annuelle à partir d'une programmation validée.
 */
export class ProgressionGenerator {
  async buildContext(input: ProgressionGenerationInput): Promise<ProgressionContext> {
    const programmation = await loadProgrammation(input.programmationId);

    if (!programmation) {
      throw new Error("Programmation introuvable.");
    }

    if (programmation.programmation.status !== "validated") {
      throw new Error("Seule une programmation validée peut générer une progression.");
    }

    const methode = input.methode || programmation.programmation.methode;

    return {
      programmation,
      referentiel: await loadReferentiel(
        programmation.programmation.levels,
        programmation.programmation.matiere,
      ),
      resources: await loadResources(
        methode,
        programmation.programmation.matiere,
      ),
      calendar: programmation.programmation.calendar_snapshot,
      timetable: programmation.programmation.timetable,
      methode,
    };
  }

  async generate(input: ProgressionGenerationInput): Promise<{
    title: string;
    tabs: ProgressionTab[];
    context: ProgressionContext;
  }> {
    const teacherProfile = await loadTeacherProfileForGeneration();
    const profileInstructions = buildTheaInstructionBlock(teacherProfile);
    const enrichedInput: ProgressionGenerationInput = {
      ...input,
      methode: input.methode || getPrimaryMethod(teacherProfile),
    };
    const context = await this.buildContext(enrichedInput);
    const tabs: ProgressionTab[] = [];

    for (const table of context.programmation.tables) {
      const rawPaths = learningPathEngine.buildPathsForTable(
        table,
        context.methode,
        context,
      );

      const sequencedPaths = new Map<number, ReturnType<typeof competenceSequencer.sequence>>();
      rawPaths.forEach((items, periodNumber) => {
        sequencedPaths.set(
          periodNumber,
          competenceSequencer.sequence(items, context.referentiel),
        );
      });

      let rows = weeklyPlanner.planTableRows(table, sequencedPaths, context);

      try {
        const prompt = buildProgressionPrompt(context, table, rows, profileInstructions);
        const raw = await askThea(prompt);
        rows = parseProgressionEnrichment(raw, rows);
      } catch (error) {
        console.error("Enrichissement Théa progression :", error);
      }

      tabs.push({
        programmingTableId: table.id,
        subjectKey: table.subjectKey,
        subjectLabel: table.subjectLabel,
        subSubjectLabel: table.subSubjectLabel,
        accent: table.accent,
        sortOrder: table.sortOrder,
        rows: rows.map((row, index) => ({
          ...row,
          id: `draft-${table.subjectKey}-${index}`,
          sortOrder: index,
        })),
      });
    }

    return {
      title: `Progression — ${context.programmation.programmation.title}`,
      tabs,
      context,
    };
  }
}

export const progressionGenerator = new ProgressionGenerator();
