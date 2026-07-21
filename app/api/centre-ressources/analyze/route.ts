import { jsonRouteError, logRouteInfo, toErrorMessage } from "@/lib/api/route-diagnostics";
import { VERCEL_MAX_DURATION_SECONDS } from "@/lib/api/vercel-serverless-config";
import {
  readBoAnalyzeProgress,
  runBoAnalyzeTick,
  startBoAnalyzeJob,
} from "@/lib/referentiel/bo-analyze-progressive";
import { getBoDocumentById } from "@/lib/referentiel/bo-document-service";
import { AiExhaustedError } from "@/lib/thea/orchestrator";
import { AI_QUEUE_USER_MESSAGE } from "@/lib/thea/messages";

const ROUTE_PATH = "/api/centre-ressources/analyze";

export const maxDuration = VERCEL_MAX_DURATION_SECONDS;

function isTransientTheaError(message: string): boolean {
  const upper = message.toUpperCase();
  return (
    upper.includes("503") ||
    upper.includes("UNAVAILABLE") ||
    upper.includes("RESOURCE_EXHAUSTED") ||
    upper.includes("OVERLOADED")
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return jsonRouteError(ROUTE_PATH, 400, "documentId requis.");
    }

    const document = await getBoDocumentById(documentId);
    if (!document) {
      return jsonRouteError(ROUTE_PATH, 404, "Document BO introuvable.");
    }

    const progress = readBoAnalyzeProgress(document);

    return Response.json({
      route: ROUTE_PATH,
      documentId,
      documentStatus: document.status,
      progress: progress?.progress ?? (document.status === "ANALYZED" ? 100 : 0),
      stageLabel: progress?.stageLabel ?? null,
      sectionsProcessed: progress?.sectionsProcessed ?? [],
      sectionsTotal: progress?.sectionsTotal ?? 0,
      insertedCount: progress?.insertedCount ?? 0,
      done: progress?.done ?? document.status === "ANALYZED",
      async: true,
    });
  } catch (error) {
    return jsonRouteError(ROUTE_PATH, 500, "Statut analyse impossible.", toErrorMessage(error));
  }
}

export async function POST(request: Request) {
  let documentId: string | undefined;

  try {
    const body = (await request.json()) as { documentId?: string; reset?: boolean };
    documentId = body.documentId;

    if (!documentId) {
      return jsonRouteError(ROUTE_PATH, 400, "documentId requis.");
    }

    logRouteInfo(ROUTE_PATH, "Analyse Théa (tick progressif)", { documentId, reset: body.reset === true });

    if (body.reset) {
      await startBoAnalyzeJob(documentId);
    }

    const result = await runBoAnalyzeTick(documentId);

    if (result.done && "document" in result && result.document) {
      return Response.json({
        route: ROUTE_PATH,
        success: true,
        async: true,
        done: true,
        progress: 100,
        documentId: result.document.id,
        documentStatus: result.document.status,
        referencesCount: result.validation.totalCompetences,
        insertedCount: result.insertedCount,
        sectionsProcessed: result.sectionsProcessed,
        validation: result.validation,
        stageLabel: result.stageLabel,
      });
    }

    return Response.json({
      route: ROUTE_PATH,
      success: true,
      async: true,
      done: false,
      progress: result.progress,
      stageLabel: result.stageLabel,
      documentId,
      documentStatus: result.documentStatus,
      sectionsProcessed: result.sectionsProcessed,
      sectionsTotal: result.sectionsTotal,
      partsCompleted: result.partsCompleted,
      partsTotal: result.partsTotal,
      insertedCount: result.insertedCount,
    });
  } catch (error) {
    const message = toErrorMessage(error);
    const document = documentId ? await getBoDocumentById(documentId) : null;

    if (error instanceof AiExhaustedError || isTransientTheaError(message)) {
      return jsonRouteError(
        ROUTE_PATH,
        503,
        AI_QUEUE_USER_MESSAGE,
        message,
        {
          documentId: document?.id ?? documentId,
          documentStatus: document?.status,
          async: true,
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
        async: true,
      },
      error,
    );
  }
}
