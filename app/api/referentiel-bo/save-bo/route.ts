import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { finalizeBoReferentiel } from "@/lib/referentiel/bo-pipeline";
import { getBoDocumentStatus } from "@/lib/referentiel/bo-document-service";

const ROUTE_PATH = "/api/referentiel-bo/save-bo";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { documentId?: string };

    if (!body.documentId) {
      return jsonRouteError(ROUTE_PATH, 400, "documentId requis.");
    }

    logRouteInfo(ROUTE_PATH, "Enregistrement référentiel BO", {
      documentId: body.documentId,
    });

    const result = await finalizeBoReferentiel(body.documentId);
    const status = await getBoDocumentStatus(result.document.id);

    return NextResponse.json({
      route: ROUTE_PATH,
      success: true,
      savedToLibrary: true,
      document: result.document,
      documentId: result.document.id,
      documentStatus: result.document.status,
      insertedCount: result.insertedCount,
      competenceCount: status.competenceCount,
      sections: status.sections,
      validation: result.validation,
      cycle: result.document.cycle,
      matiere: result.document.matiere,
      niveau: result.document.niveau ?? "",
      fileName: result.document.original_filename,
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible d'enregistrer le référentiel BO.",
      toErrorMessage(error),
    );
  }
}
