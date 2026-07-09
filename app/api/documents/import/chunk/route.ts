import { chunkUploader } from "@/lib/documents/import/ChunkUploader";
import { uploadManager } from "@/lib/documents/import/UploadManager";
import {
  handleImportRouteError,
  importJsonSuccess,
  importRouteError,
  logImportRouteStart,
  ROUTE_IMPORT,
} from "@/lib/documents/import/route-helpers";

const SUBPATH = "/chunk";

export async function POST(request: Request) {
  let routeContext: {
    sessionId?: string;
    fileSizeBytes?: number;
    storageKey?: string;
    fileName?: string;
  } = {};

  try {
    const formData = await request.formData();
    const sessionId = String(formData.get("sessionId") ?? "").trim();
    const chunkIndexRaw = formData.get("chunkIndex");
    const chunk = formData.get("chunk");

    if (!sessionId) {
      return importRouteError(SUBPATH, 400, "sessionId requis.");
    }

    const chunkIndex = Number.parseInt(String(chunkIndexRaw ?? ""), 10);
    if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
      return importRouteError(SUBPATH, 400, "chunkIndex invalide.");
    }

    if (!(chunk instanceof Blob)) {
      return importRouteError(SUBPATH, 400, "chunk requis.");
    }

    const session = await uploadManager.getSession(sessionId);
    if (!session) {
      return importRouteError(SUBPATH, 404, "Session d'upload introuvable.");
    }

    if (session.status === "cancelled" || session.status === "failed") {
      return importRouteError(SUBPATH, 409, "Session d'upload annulée ou expirée.");
    }

    routeContext = {
      sessionId,
      fileSizeBytes: chunk.size,
      storageKey: session.storagePath,
      fileName: session.originalFilename,
    };

    logImportRouteStart(SUBPATH, {
      ...routeContext,
      contentType: "application/octet-stream",
    });

    const buffer = Buffer.from(await chunk.arrayBuffer());
    const result = await chunkUploader.storeChunk({
      sessionId,
      chunkIndex,
      buffer,
      expectedTotalChunks: session.totalChunks,
    });

    return importJsonSuccess({
      route: `${ROUTE_IMPORT}${SUBPATH}`,
      ...result,
    });
  } catch (error) {
    return handleImportRouteError(SUBPATH, error, "storage_upload", routeContext);
  }
}
