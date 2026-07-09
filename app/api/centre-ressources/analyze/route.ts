import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { getBoDocumentById } from "@/lib/referentiel/bo-document-service";
import { runBoAnalyzeStep } from "@/lib/referentiel/bo-pipeline";
import { GeminiExhaustedError } from "@/lib/thea/services/gemini-errors";
import { GEMINI_QUEUE_USER_MESSAGE } from "@/lib/thea/messages";

const ROUTE_PATH = "/api/centre-ressources/analyze";

function isTransientTheaError(message: string): boolean {
  const upper = message.toUpperCase();
  return (
    upper.includes("503") ||
    upper.includes("UNAVAILABLE") ||
    upper.includes("RESOURCE_EXHAUSTED") ||
    upper.includes("OVERLOADED")
  );
}

export async function POST(request: Request) {
  let documentId: string | undefined;

  try {
    const body = (await request.json()) as { documentId?: string };
    documentId = body.documentId;

    if (!documentId) {
      return jsonRouteError(ROUTE_PATH, 400, "documentId requis.");
    }

    logRouteInfo(ROUTE_PATH, "Analyse Théa", { documentId });

    const result = await runBoAnalyzeStep(documentId);

    return Response.json({
      route: ROUTE_PATH,
      success: true,
      documentId: result.document.id,
      documentStatus: result.document.status,
      referencesCount: result.validation.totalCompetences,
      insertedCount: result.insertedCount,
      sectionsProcessed: result.sectionsProcessed,
      validation: result.validation,
      competences: result.competences.slice(0, 120),
    });
  } catch (error) {
    const message = toErrorMessage(error);
    const document = documentId ? await getBoDocumentById(documentId) : null;

    if (error instanceof GeminiExhaustedError || isTransientTheaError(message)) {
      return jsonRouteError(
        ROUTE_PATH,
        503,
        GEMINI_QUEUE_USER_MESSAGE,
        message,
        {
          documentId: document?.id ?? documentId,
          documentStatus: document?.status,
        },
        error,
      );
    }

    return jsonRouteError(
      ROUTE_PATH,
      500,
      "Analyse Théa échouée. Le document et le texte extrait sont conservés.",
      message,
      {
        documentId: document?.id ?? documentId,
        documentStatus: document?.status,
      },
      error,
    );
  }
}
