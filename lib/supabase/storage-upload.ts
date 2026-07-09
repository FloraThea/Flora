import "server-only";

import { storageService, readDocumentStorageProvider } from "@/lib/storage";
import { failImportPipeline, type ImportFailureContext } from "@/lib/documents/import/import-error-diagnostics";
import { formatBytes } from "@/lib/documents/import/config";
import { MAX_UPLOAD_SIZE } from "@/lib/upload/max-upload-size";

export type StorageUploadInput = {
  bucket?: string;
  storagePath: string;
  body: Buffer | Blob | File | ArrayBuffer;
  contentType?: string;
  upsert?: boolean;
  fileName?: string;
  sessionId?: string;
  documentId?: string;
  userId?: string;
  context?: string;
  storageProvider?: "cloudflare_r2" | "supabase";
};

export type StorageUploadResult = {
  bucket: string;
  storagePath: string;
  fileSizeBytes: number;
  contentType: string;
  fileName: string | null;
  provider: string;
};

async function resolveBodySize(body: StorageUploadInput["body"]): Promise<number> {
  if (Buffer.isBuffer(body)) return body.length;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (body instanceof Blob) return body.size;
  return (body as File).size ?? 0;
}

export async function uploadToSupabaseStorage(input: StorageUploadInput): Promise<StorageUploadResult> {
  const fileSizeBytes = await resolveBodySize(input.body);
  const contentType = input.contentType ?? "application/octet-stream";
  const fileName = input.fileName ?? null;
  const provider = input.storageProvider ?? readDocumentStorageProvider({ storage_provider: input.storageProvider }) ?? storageService.getActiveProviderName();

  const logContext: ImportFailureContext = {
    step: "storage_upload",
    bucket: input.bucket,
    storagePath: input.storagePath,
    fileSizeBytes,
    contentType,
    fileName: fileName ?? undefined,
    sessionId: input.sessionId,
    documentId: input.documentId,
    extra: {
      upsert: input.upsert ?? false,
      operationContext: input.context ?? "upload",
      maxUploadSizeBytes: MAX_UPLOAD_SIZE,
      maxUploadSizeLabel: formatBytes(MAX_UPLOAD_SIZE),
      userId: input.userId,
    },
  };

  console.info("[storage-upload] Envoi via StorageService", logContext);

  try {
    const result = await storageService.upload(
      {
        key: input.storagePath,
        body: input.body,
        contentType,
        fileName: fileName ?? undefined,
        userId: input.userId,
      },
      {
        sessionId: input.sessionId,
        documentId: input.documentId,
        fileName: fileName ?? undefined,
        userId: input.userId,
        operation: input.context,
      },
      provider === "supabase" ? "supabase" : "cloudflare_r2",
    );

    return {
      bucket: result.bucket,
      storagePath: result.key,
      fileSizeBytes: result.fileSizeBytes,
      contentType: result.contentType,
      fileName,
      provider: result.provider,
    };
  } catch (error) {
    failImportPipeline(logContext, error);
  }
}

export async function downloadFromSupabaseStorage(input: {
  bucket?: string;
  storagePath: string;
  fileName?: string;
  sessionId?: string;
  documentId?: string;
  userId?: string;
  storageProvider?: "cloudflare_r2" | "supabase";
}): Promise<Buffer> {
  const context: ImportFailureContext = {
    step: "storage_download",
    bucket: input.bucket,
    storagePath: input.storagePath,
    fileName: input.fileName,
    sessionId: input.sessionId,
    documentId: input.documentId,
    extra: { userId: input.userId },
  };

  try {
    const result = await storageService.download(
      input.storagePath,
      {
        sessionId: input.sessionId,
        documentId: input.documentId,
        fileName: input.fileName,
        userId: input.userId,
      },
      input.storageProvider,
    );
    return result.body;
  } catch (error) {
    failImportPipeline(context, error);
  }
}

export async function getSignedDocumentUrl(input: {
  storagePath: string;
  storageProvider?: "cloudflare_r2" | "supabase";
  expiresInSeconds?: number;
  fileName?: string;
}): Promise<string> {
  return storageService.getSignedUrl(
    input.storagePath,
    {
      expiresInSeconds: input.expiresInSeconds,
      contentDisposition: input.fileName ? `inline; filename="${input.fileName}"` : undefined,
    },
    input.storageProvider,
  );
}
