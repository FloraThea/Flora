import {
  buildImportStatusPayload,
  handleImportRouteError,
  importJsonSuccess,
  ROUTE_IMPORT,
} from "@/lib/documents/import/route-helpers";
import { importQueue } from "@/lib/documents/import/ImportQueue";

const SUBPATH = "/status";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");
    const documentId = url.searchParams.get("documentId");
    const jobId = url.searchParams.get("jobId");

    const payload = await buildImportStatusPayload({ sessionId, documentId, jobId });

    void importQueue.processNext();

    return importJsonSuccess({
      route: `${ROUTE_IMPORT}${SUBPATH}`,
      ...payload,
    });
  } catch (error) {
    return handleImportRouteError(SUBPATH, error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "pause" | "resume" | "cancel" | "reorder" | "process";
      jobId?: string;
      jobIds?: string[];
    };

    if (!body.action) {
      return handleImportRouteError(SUBPATH, new Error("action requise."));
    }

    switch (body.action) {
      case "pause":
        if (!body.jobId) throw new Error("jobId requis.");
        await importQueue.pauseJob(body.jobId);
        break;
      case "resume":
        if (!body.jobId) throw new Error("jobId requis.");
        await importQueue.resumeJob(body.jobId);
        break;
      case "cancel":
        if (!body.jobId) throw new Error("jobId requis.");
        await importQueue.cancelJob(body.jobId);
        break;
      case "reorder":
        if (!body.jobIds?.length) throw new Error("jobIds requis.");
        await importQueue.reorder(body.jobIds);
        void importQueue.processNext();
        break;
      case "process":
        void importQueue.processNext();
        break;
      default:
        throw new Error("action inconnue.");
    }

    const payload = await buildImportStatusPayload({ jobId: body.jobId ?? null });
    const jobs = await importQueue.listActiveJobs();

    return importJsonSuccess({
      route: `${ROUTE_IMPORT}${SUBPATH}`,
      jobs,
      ...payload,
    });
  } catch (error) {
    return handleImportRouteError(SUBPATH, error);
  }
}
