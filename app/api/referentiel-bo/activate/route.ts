import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { activateBoDocument, getBoDocumentStatus } from "@/lib/referentiel/bo-document-service";

const ROUTE_PATH = "/api/referentiel-bo/activate";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { documentId?: string };

    if (!body.documentId) {
      return jsonRouteError(ROUTE_PATH, 400, "documentId requis.");
    }

    const document = await activateBoDocument(body.documentId);
    const status = await getBoDocumentStatus(document.id);

    logRouteInfo(ROUTE_PATH, "BO activé pour programmations", {
      documentId: document.id,
      matiere: document.matiere,
      competenceCount: status.competenceCount,
    });

    return NextResponse.json({
      route: ROUTE_PATH,
      success: true,
      document,
      competenceCount: status.competenceCount,
      sections: status.sections,
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible d'activer le référentiel BO.",
      toErrorMessage(error),
    );
  }
}
