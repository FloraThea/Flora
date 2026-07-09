import { uploadManager } from "@/lib/documents/import/UploadManager";
import type { DuplicateResolution } from "@/lib/documents/import/types";
import {
  handleImportRouteError,
  findDuplicateCandidates,
  importJsonSuccess,
  importRouteError,
  logImportRouteStart,
  ROUTE_IMPORT,
} from "@/lib/documents/import/route-helpers";

const SUBPATH = "/complete";

export async function POST(request: Request) {
  let routeContext: {
    sessionId?: string;
    fileName?: string;
    fileSizeBytes?: number;
    storageKey?: string;
  } = {};

  try {
    const body = (await request.json()) as {
      sessionId?: string;
      checksum?: string;
      duplicateResolution?: DuplicateResolution;
    };

    if (!body.sessionId) {
      return importRouteError(SUBPATH, 400, "sessionId requis.");
    }

    const session = await uploadManager.getSession(body.sessionId);
    routeContext = {
      sessionId: body.sessionId,
      fileName: session?.originalFilename,
      fileSizeBytes: session?.fileSize,
      storageKey: session?.storagePath,
    };

    logImportRouteStart(SUBPATH, routeContext);

    const result = await uploadManager.completeUpload({
      sessionId: body.sessionId,
      checksum: body.checksum,
      duplicateResolution: body.duplicateResolution,
    });

    if (result.duplicateDetected) {
      const duplicateCandidates = await findDuplicateCandidates(body.sessionId);
      return importJsonSuccess({
        route: `${ROUTE_IMPORT}${SUBPATH}`,
        ...result,
        duplicateCandidates,
      });
    }

    return importJsonSuccess({
      route: `${ROUTE_IMPORT}${SUBPATH}`,
      ...result,
    });
  } catch (error) {
    return handleImportRouteError(SUBPATH, error, "chunk_merge", routeContext);
  }
}
