import { NextResponse } from "next/server";
import { jsonRouteError, toErrorMessage } from "@/lib/api/route-diagnostics";
import { getBoDocumentById, getBoDocumentStatus } from "@/lib/referentiel/bo-document-service";
import { listBoDocumentsWithCounts } from "@/lib/referentiel/bo-document-service";
import { getStorageBucketHealth } from "@/lib/supabase/storage-health";

const ROUTE_PATH = "/api/centre-ressources/list";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (documentId) {
      const status = await getBoDocumentStatus(documentId);
      const document = await getBoDocumentById(documentId);
      const storage = await getStorageBucketHealth();

      return NextResponse.json({
        route: ROUTE_PATH,
        document,
        competenceCount: status.competenceCount,
        sections: status.sections,
        storage,
      });
    }

    const documents = await listBoDocumentsWithCounts();
    const storage = await getStorageBucketHealth();

    return NextResponse.json({
      route: ROUTE_PATH,
      documents: documents.map((document) => ({
        id: document.id,
        original_filename: document.original_filename,
        original_name: document.original_name ?? document.original_filename,
        matiere: document.matiere,
        cycle: document.cycle,
        niveau: document.niveau ?? "",
        domaine: document.domaine,
        document_type: document.document_type ?? "bo_officiel",
        status: document.status,
        error_message:
          document.error_message ??
          (document.metadata?.error_message as string | undefined) ??
          "",
        active_for_programmation: document.active_for_programmation,
        competence_count: document.competence_count,
        text_length: document.text_length,
        page_count: document.page_count,
        created_at: document.created_at,
        updated_at: document.updated_at,
        sections: Array.isArray(document.metadata?.sectionsProcessed)
          ? document.metadata.sectionsProcessed
          : [],
        analyzeProgress:
          document.metadata?.analyzeProgress && typeof document.metadata.analyzeProgress === "object"
            ? document.metadata.analyzeProgress
            : null,
        validation: document.validation,
      })),
      storage,
    });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Liste impossible.", toErrorMessage(error));
  }
}
