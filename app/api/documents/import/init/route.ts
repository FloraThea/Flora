import { uploadManager } from "@/lib/documents/import/UploadManager";
import {
  handleImportRouteError,
  importJsonSuccess,
  importRouteError,
  logImportRouteStart,
  ROUTE_IMPORT,
} from "@/lib/documents/import/route-helpers";

const SUBPATH = "/init";

export async function POST(request: Request) {
  let requestContext: {
    fileName?: string;
    fileSizeBytes?: number;
    contentType?: string;
  } = {};

  try {
    const body = (await request.json()) as {
      filename?: string;
      fileSize?: number;
      contentType?: string;
      checksum?: string;
    };

    requestContext = {
      fileName: body.filename?.trim(),
      fileSizeBytes: body.fileSize,
      contentType: body.contentType,
    };

    if (!body.filename?.trim() || !body.fileSize || body.fileSize <= 0) {
      return importRouteError(SUBPATH, 400, "filename et fileSize requis.");
    }

    logImportRouteStart(SUBPATH, requestContext);

    const result = await uploadManager.initUpload({
      filename: body.filename.trim(),
      fileSize: body.fileSize,
      contentType: body.contentType,
      checksum: body.checksum,
    });

    logImportRouteStart(SUBPATH, {
      ...requestContext,
      storageKey: result.storagePath,
    });

    return importJsonSuccess({
      route: `${ROUTE_IMPORT}${SUBPATH}`,
      ...result,
    });
  } catch (error) {
    return handleImportRouteError(SUBPATH, error, "storage_upload", requestContext);
  }
}
