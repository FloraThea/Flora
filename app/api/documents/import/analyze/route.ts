import { VERCEL_MAX_DURATION_SECONDS } from "@/lib/api/vercel-serverless-config";
import { importQueue } from "@/lib/documents/import/ImportQueue";
import {
  handleImportRouteError,
  importJsonSuccess,
  importRouteError,
  ROUTE_IMPORT,
} from "@/lib/documents/import/route-helpers";

const SUBPATH = "/analyze";

export const maxDuration = VERCEL_MAX_DURATION_SECONDS;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { documentId?: string; jobId?: string };

    if (!body.documentId) {
      return importRouteError(SUBPATH, 400, "documentId requis.");
    }

    const job =
      (body.jobId ? await importQueue.getJob(body.jobId) : null) ??
      (await importQueue.getJobForDocument(body.documentId));

    if (!job) {
      const enqueued = await importQueue.enqueue(body.documentId);
      void importQueue.processNext();
      return importJsonSuccess({
        route: `${ROUTE_IMPORT}${SUBPATH}`,
        jobId: enqueued.id,
        message: "Analyse ajoutée à la file.",
      });
    }

    if (job.status === "queued" || job.status === "paused") {
      void importQueue.processNext();
      return importJsonSuccess({
        route: `${ROUTE_IMPORT}${SUBPATH}`,
        jobId: job.id,
        message: "Analyse en cours de démarrage.",
      });
    }

    if (job.status === "failed") {
      await importQueue.enqueue(body.documentId);
      void importQueue.processNext();
      return importJsonSuccess({
        route: `${ROUTE_IMPORT}${SUBPATH}`,
        jobId: job.id,
        message: "Analyse relancée.",
      });
    }

    return importJsonSuccess({
      route: `${ROUTE_IMPORT}${SUBPATH}`,
      jobId: job.id,
      status: job.status,
      message: "Analyse déjà en cours ou terminée.",
    });
  } catch (error) {
    return handleImportRouteError(SUBPATH, error);
  }
}
