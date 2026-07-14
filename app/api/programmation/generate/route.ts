import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  ProgrammingGenerationError,
  programmingGenerator,
} from "@/lib/programming/ProgrammingGenerator";
import { programmingValidator } from "@/lib/programming/ProgrammingValidator";
import { saveProgrammation } from "@/lib/programming/programmation-service";
import type { ProgrammingGenerationInput } from "@/lib/programming/types";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import {
  logProgrammingGeneration,
  logProgrammingGenerationError,
  userMessageForGenerationError,
} from "@/lib/programming/generation-diagnostics";

const ROUTE_PATH = "/api/programmation/generate";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProgrammingGenerationInput;

    logProgrammingGeneration("form-validation", {
      schoolYear: body.schoolYear,
      academicZone: body.academicZone,
      levels: body.levels,
      matiere: body.matiere,
    });

    if (!body.schoolYear || !body.academicZone || body.levels.length === 0) {
      return jsonRouteError(
        ROUTE_PATH,
        400,
        "Année scolaire, zone académique et niveau(x) requis.",
      );
    }

    if (!body.matiere?.trim()) {
      return jsonRouteError(ROUTE_PATH, 400, "La matière est obligatoire pour générer une programmation.");
    }

    logRouteInfo(ROUTE_PATH, "Génération programmation", {
      schoolYear: body.schoolYear,
      matiere: body.matiere,
      levels: body.levels,
    });

    const generated = await programmingGenerator.generate(body);
    const validation = programmingValidator.validate(generated.tables, generated.context);

    const referentielWarning =
      !generated.context.boDocumentId
        ? "Aucun référentiel BO validé pour cette matière. Importez et validez un bulletin officiel dans la Bibliothèque documentaire."
        : generated.context.referentiel.length === 0
          ? "Le référentiel BO actif ne contient aucune compétence pour ces niveaux. Vérifiez l'analyse et la validation dans la Bibliothèque documentaire."
          : null;

    logProgrammingGeneration("database-save-start", {
      tableCount: generated.tables.length,
      title: generated.title,
    });

    const payload = await saveProgrammation({
      title: generated.title,
      generationInput: body,
      calendarSnapshot: generated.context.calendar,
      validation,
      tables: generated.tables,
    });

    logProgrammingGeneration("database-save-done", {
      programmationId: payload.programmation.id,
    });

    void pedagogicalEngine.genererCahierJournal(payload.programmation.id).catch((journalError) => {
      logProgrammingGenerationError("completed", journalError, {
        phase: "journal-sync",
        programmationId: payload.programmation.id,
      });
    });

    logProgrammingGeneration("completed", { programmingId: payload.programmation.id });

    return NextResponse.json({
      route: ROUTE_PATH,
      referentielWarning,
      ...payload,
    });
  } catch (error) {
    const step =
      error instanceof ProgrammingGenerationError ? error.step : "database-save-start";
    logProgrammingGenerationError(step as "ai-parse", error, { route: ROUTE_PATH });

    const status = error instanceof ProgrammingGenerationError ? 422 : 500;
    const userMessage = userMessageForGenerationError(error, step);

    return jsonRouteError(
      ROUTE_PATH,
      status,
      userMessage,
      toErrorMessage(error),
      { failedStep: step },
      error,
    );
  }
}
