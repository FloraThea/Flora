import "server-only";

import { inspectError } from "@/lib/supabase/error-inspection";
import type { StorageProviderName } from "./config";

export type StorageFailureContext = {
  provider: StorageProviderName;
  operation: string;
  bucket?: string;
  key?: string;
  fileSizeBytes?: number;
  contentType?: string;
  fileName?: string;
  userId?: string;
  sessionId?: string;
  documentId?: string;
  extra?: Record<string, unknown>;
};

export class StorageServiceError extends Error {
  provider: StorageProviderName;
  operation: string;
  cloudflare: ReturnType<typeof inspectError>;
  context: StorageFailureContext;

  constructor(error: unknown, context: StorageFailureContext) {
    const inspected = inspectError(error);
    super(`[${context.provider}/${context.operation}] ${inspected.message}`);
    this.name = "StorageServiceError";
    this.provider = context.provider;
    this.operation = context.operation;
    this.cloudflare = inspected;
    this.context = context;
  }
}

export function logStorageFailure(context: StorageFailureContext, error: unknown): StorageServiceError {
  const storageError = new StorageServiceError(error, context);
  const inspected = storageError.cloudflare;

  console.error("[storage] Échec", {
    provider: context.provider,
    operation: context.operation,
    bucket: context.bucket,
    key: context.key,
    fileSizeBytes: context.fileSizeBytes,
    contentType: context.contentType,
    fileName: context.fileName,
    userId: context.userId,
    sessionId: context.sessionId,
    documentId: context.documentId,
    extra: context.extra,
    error,
    "error.message": inspected.message,
    "error.statusCode": inspected.statusCode,
    "error.status": inspected.status,
    "error.name": inspected.name,
    "error.code": inspected.code,
    "error.details": inspected.details,
    "error.hint": inspected.hint,
    httpResponse: inspected.httpResponse,
    cloudflareResponse: inspected.json,
  });

  return storageError;
}

export function failStorage(context: StorageFailureContext, error: unknown): never {
  throw logStorageFailure(context, error);
}

export function storageErrorToPayload(error: unknown): {
  error: string;
  provider?: StorageProviderName;
  operation?: string;
  context?: StorageFailureContext;
  cloudflare?: string;
} {
  if (error instanceof StorageServiceError) {
    return {
      error: error.cloudflare.message,
      provider: error.provider,
      operation: error.operation,
      context: error.context,
      cloudflare: error.cloudflare.json,
    };
  }

  const inspected = inspectError(error);
  return {
    error: inspected.message,
    cloudflare: inspected.json,
  };
}
