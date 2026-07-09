import { importQueue } from "@/lib/documents/import/ImportQueue";
import {
  handleImportRouteError,
  importJsonSuccess,
  importRouteError,
  resolveDuplicateUpload,
  ROUTE_IMPORT,
} from "@/lib/documents/import/route-helpers";
import type { DuplicateResolution } from "@/lib/documents/import/types";

const SUBPATH = "/duplicate-resolve";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      sessionId?: string;
      resolution?: DuplicateResolution;
      checksum?: string;
    };

    if (!body.sessionId || !body.resolution) {
      return importRouteError(SUBPATH, 400, "sessionId et resolution requis.");
    }

    const result = await resolveDuplicateUpload({
      sessionId: body.sessionId,
      resolution: body.resolution,
      checksum: body.checksum,
    });

    void importQueue.processNext();

    return importJsonSuccess({
      route: `${ROUTE_IMPORT}${SUBPATH}`,
      ...result,
    });
  } catch (error) {
    return handleImportRouteError(SUBPATH, error);
  }
}
