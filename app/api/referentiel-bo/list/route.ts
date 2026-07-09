import { NextResponse } from "next/server";
import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { listBoDocumentsWithCounts } from "@/lib/referentiel/bo-document-service";

const ROUTE_PATH = "/api/referentiel-bo/list";

export async function GET() {
  try {
    const documents = await listBoDocumentsWithCounts();

    logRouteInfo(ROUTE_PATH, "Liste documents BO", {
      count: documents.length,
    });

    return NextResponse.json({
      route: ROUTE_PATH,
      documents: documents.map((document) => ({
        id: document.id,
        original_filename: document.original_filename,
        matiere: document.matiere,
        cycle: document.cycle,
        niveau: document.niveau ?? "",
        status: document.status,
        active_for_programmation: document.active_for_programmation,
        competence_count: document.competence_count,
        text_length: document.text_length,
        created_at: document.created_at,
        updated_at: document.updated_at,
        sections: Array.isArray(document.metadata?.sectionsProcessed)
          ? document.metadata.sectionsProcessed
          : [],
      })),
    });
  } catch (error) {
    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Impossible de lister les référentiels BO.",
      toErrorMessage(error),
    );
  }
}
