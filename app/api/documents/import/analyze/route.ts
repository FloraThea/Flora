import { importQueue } from "@/lib/documents/import/ImportQueue";
import {
  handleImportRouteError,
  importJsonSuccess,
  importRouteError,
  ROUTE_IMPORT,
} from "@/lib/documents/import/route-helpers";

const SUBPATH = "/analyze";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { documentId?: string; jobId?: string };

    if (!body.documentId) {
      return importRouteError(SUBPATH, 400, "documentId requis.");
    }

    const job = await importQueue.processDocument(body.documentId, body.jobId);

    if (!job) {
      return importRouteError(SUBPATH, 404, "Job d'import introuvable.");
    }

    return importJsonSuccess({
      route: `${ROUTE_IMPORT}${SUBPATH}`,
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      message:
        job.status === "completed"
          ? "Analyse terminée."
          : job.status === "waiting_ai"
            ? job.stageLabel || "Analyse en attente de quota IA."
            : job.status === "failed"
              ? job.errorMessage || "Analyse impossible."
              : "Analyse en cours…",
    });
  } catch (error) {
    return handleImportRouteError(SUBPATH, error);
  }
}
