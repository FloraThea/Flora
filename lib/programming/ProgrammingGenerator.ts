import { askThea } from "@/lib/thea/services/gemini";
import {
  applyProfileToProgrammingInput,
  buildTheaInstructionBlock,
  loadTeacherProfileForGeneration,
} from "@/lib/profile";
import type {
  PlannerContext,
  ProgrammingGenerationInput,
  ProgrammingTable,
} from "./types";
import { mergeGeneratedCells, pedagogicalPlanner } from "./PedagogicalPlanner";
import { buildProgrammationPrompt, parseProgrammationResponse } from "./prompts/generateProgrammation";

/**
 * Génère une programmation annuelle structurée à partir des données réelles.
 */
export class ProgrammingGenerator {
  async generate(input: ProgrammingGenerationInput): Promise<{
    tables: ProgrammingTable[];
    context: PlannerContext;
    title: string;
  }> {
    const teacherProfile = await loadTeacherProfileForGeneration();
    const mergedInput = applyProfileToProgrammingInput(input, teacherProfile);
    const context = await pedagogicalPlanner.buildContext(mergedInput);
    const skeletons = pedagogicalPlanner.buildTableSkeletons(
      mergedInput,
      context.calendar,
      context.referentiel,
      context.boDocumentId ?? null,
    );

    console.info("[programmation] Données utilisées pour la génération", {
      referentielRows: context.referentiel.length,
      resourceRows: context.resources.length,
      tableCount: skeletons.length,
      matiere: mergedInput.matiere,
      disciplines: [...new Set(context.referentiel.map((row) => row.discipline).filter(Boolean))],
    });

    let generatedPayload: ReturnType<typeof parseProgrammationResponse> = {
      title: `Programmation ${mergedInput.schoolYear} — ${mergedInput.levels.join(", ")}`,
      tables: [],
    };

    try {
      const prompt = buildProgrammationPrompt(
        mergedInput,
        context,
        skeletons,
        buildTheaInstructionBlock(teacherProfile),
      );
      const raw = await askThea(prompt);
      generatedPayload = parseProgrammationResponse(raw, skeletons);
    } catch (error) {
      console.error("Erreur génération Théa programmation :", error);
    }

    const tables = mergeGeneratedCells(skeletons, generatedPayload.tables);

    return {
      tables,
      context,
      title: generatedPayload.title,
    };
  }
}

export const programmingGenerator = new ProgrammingGenerator();
