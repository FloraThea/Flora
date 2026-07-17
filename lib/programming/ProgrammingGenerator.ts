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
import {
  countFilledCells,
  logProgrammingGeneration,
  logProgrammingGenerationError,
} from "./generation-diagnostics";

export class ProgrammingGenerationError extends Error {
  step: string;

  constructor(step: string, message: string, cause?: unknown) {
    super(message);
    this.name = "ProgrammingGenerationError";
    this.step = step;
    if (cause instanceof Error && cause.stack) {
      this.stack = cause.stack;
    }
  }
}

/**
 * Génère une programmation annuelle structurée à partir des données réelles.
 */
export class ProgrammingGenerator {
  async generate(input: ProgrammingGenerationInput): Promise<{
    tables: ProgrammingTable[];
    context: PlannerContext;
    title: string;
    aiGenerated: boolean;
  }> {
    logProgrammingGeneration("payload-ready", {
      schoolYear: input.schoolYear,
      matiere: input.matiere,
      levels: input.levels,
    });

    const teacherProfile = await loadTeacherProfileForGeneration();
    const mergedInput = await applyProfileToProgrammingInput(input, teacherProfile);
    const context = await pedagogicalPlanner.buildContext(mergedInput);
    const skeletons = pedagogicalPlanner.buildTableSkeletons(
      mergedInput,
      context.calendar,
      context.referentiel,
      context.boDocumentId ?? null,
    );

    logProgrammingGeneration("context-built", {
      referentielRows: context.referentiel.length,
      resourceRows: context.resources.length,
      tableCount: skeletons.length,
      matiere: mergedInput.matiere,
    });

    if (skeletons.length === 0) {
      throw new ProgrammingGenerationError(
        "context-built",
        "Aucune table de programmation n'a pu être créée. Vérifiez la matière sélectionnée et le référentiel BO importé.",
      );
    }

    let generatedPayload: ReturnType<typeof parseProgrammationResponse> = {
      title: `Programmation ${mergedInput.schoolYear} — ${mergedInput.levels.join(", ")}`,
      tables: [],
    };
    let aiGenerated = false;

    try {
      logProgrammingGeneration("ai-request-start", { skeletonCount: skeletons.length });
      const prompt = buildProgrammationPrompt(
        mergedInput,
        context,
        skeletons,
        buildTheaInstructionBlock(teacherProfile),
      );
      const raw = await askThea(prompt);
      logProgrammingGeneration("ai-response-received", { responseLength: raw.length });
      generatedPayload = parseProgrammationResponse(raw, skeletons);
      logProgrammingGeneration("ai-parse", {
        parsedTables: generatedPayload.tables.length,
      });
      aiGenerated = true;
    } catch (error) {
      logProgrammingGenerationError("ai-parse", error);
      throw new ProgrammingGenerationError(
        "ai-parse",
        "La génération par l'IA a échoué. Vérifiez la clé GEMINI_API_KEY et réessayez.",
        error,
      );
    }

    const tables = mergeGeneratedCells(skeletons, generatedPayload.tables);
    const filledCells = countFilledCells(tables);

    if (filledCells === 0) {
      throw new ProgrammingGenerationError(
        "ai-parse",
        "Le contenu généré est vide. La génération a échoué avant l'enregistrement.",
      );
    }

    logProgrammingGeneration("validation", {
      tableCount: tables.length,
      filledCells,
    });

    return {
      tables,
      context,
      title: generatedPayload.title,
      aiGenerated,
    };
  }
}

export const programmingGenerator = new ProgrammingGenerator();
