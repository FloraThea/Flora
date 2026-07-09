import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { programmingGenerator } from "@/lib/programming/ProgrammingGenerator";
import { programmingValidator } from "@/lib/programming/ProgrammingValidator";
import { saveProgrammation } from "@/lib/programming/programmation-service";
import type { ProgrammingGenerationInput } from "@/lib/programming/types";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";

const ROUTE_PATH = "/api/programmation/generate";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProgrammingGenerationInput;

    if (!body.schoolYear || !body.academicZone || body.levels.length === 0) {
      return jsonRouteError(
        ROUTE_PATH,
        400,
        "Année scolaire, zone académique et niveau(x) requis.",
      );
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

    logRouteInfo(ROUTE_PATH, "Contexte référentiel utilisé", {
      referentielRows: generated.context.referentiel.length,
      resourceRows: generated.context.resources.length,
      disciplines: [
        ...new Set(generated.context.referentiel.map((row) => row.discipline).filter(Boolean)),
      ],
    });

    const payload = await saveProgrammation({
      title: generated.title,
      generationInput: body,
      calendarSnapshot: generated.context.calendar,
      validation,
      tables: generated.tables,
    });

    void pedagogicalEngine.genererCahierJournal(payload.programmation.id);

    return NextResponse.json({
      route: ROUTE_PATH,
      referentielWarning,
      ...payload,
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de générer la programmation.",
      toErrorMessage(error),
    );
  }
}
