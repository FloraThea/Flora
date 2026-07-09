import "server-only";

import {
  getExactErrorMessage,
  inspectError,
  logInspectedError,
} from "@/lib/supabase/error-inspection";
import { StorageServiceError, storageErrorToPayload } from "@/lib/storage/storage-errors";

export type ImportPipelineStep =
  | "storage_upload"
  | "storage_download"
  | "chunk_merge"
  | "metadata_creation"
  | "database_insert"
  | "database_update"
  | "database_query"
  | "edge_function"
  | "ocr"
  | "vectorization"
  | "analysis"
  | "extraction";

export const IMPORT_STEP_LABELS: Record<ImportPipelineStep, string> = {
  storage_upload: "upload vers Storage",
  storage_download: "téléchargement Storage",
  chunk_merge: "fusion des chunks",
  metadata_creation: "création des métadonnées",
  database_insert: "insertion en base",
  database_update: "mise à jour en base",
  database_query: "lecture en base",
  edge_function: "Edge Function",
  ocr: "OCR",
  vectorization: "vectorisation",
  analysis: "analyse Théa",
  extraction: "extraction du texte",
};

export type ImportFailureContext = {
  step: ImportPipelineStep;
  bucket?: string;
  storagePath?: string;
  fileSizeBytes?: number;
  contentType?: string;
  fileName?: string;
  sessionId?: string;
  documentId?: string;
  jobId?: string;
  table?: string;
  extra?: Record<string, unknown>;
};

export class ImportPipelineError extends Error {
  step: ImportPipelineStep;
  stepLabel: string;
  supabase: ReturnType<typeof inspectError>;
  context: ImportFailureContext;

  constructor(error: unknown, context: ImportFailureContext) {
    const supabase = inspectError(error);
    const stepLabel = IMPORT_STEP_LABELS[context.step];
    super(`[${stepLabel}] ${supabase.message}`);
    this.name = "ImportPipelineError";
    this.step = context.step;
    this.stepLabel = stepLabel;
    this.supabase = supabase;
    this.context = context;
  }
}

export function logImportPipelineFailure(context: ImportFailureContext, error: unknown): ImportPipelineError {
  const pipelineError = new ImportPipelineError(error, context);
  const inspected = pipelineError.supabase;

  console.error("[import-pipeline] Échec", {
    step: context.step,
    stepLabel: pipelineError.stepLabel,
    bucket: context.bucket,
    storagePath: context.storagePath,
    fileSizeBytes: context.fileSizeBytes,
    contentType: context.contentType,
    fileName: context.fileName,
    sessionId: context.sessionId,
    documentId: context.documentId,
    jobId: context.jobId,
    table: context.table,
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
    supabaseResponse: inspected.json,
  });

  return pipelineError;
}

export function failImportPipeline(context: ImportFailureContext, error: unknown): never {
  throw logImportPipelineFailure(context, error);
}

export function wrapImportStep<T>(
  context: ImportFailureContext,
  run: () => Promise<T>,
): Promise<T> {
  return run().catch((error) => {
    failImportPipeline(context, error);
  });
}

export function importErrorToApiPayload(error: unknown): {
  error: string;
  step?: ImportPipelineStep;
  stepLabel?: string;
  supabase?: string;
  context?: ImportFailureContext;
  storage?: ReturnType<typeof storageErrorToPayload>;
  missingEnv?: string[];
} {
  if (error instanceof ImportPipelineError) {
    return {
      error: error.supabase.message,
      step: error.step,
      stepLabel: error.stepLabel,
      supabase: error.supabase.json,
      context: error.context,
      missingEnv: Array.isArray(error.context.extra?.missingEnv)
        ? (error.context.extra.missingEnv as string[])
        : undefined,
    };
  }

  if (error instanceof StorageServiceError) {
    const storage = storageErrorToPayload(error);
    return {
      error: storage.error,
      step: "storage_upload",
      stepLabel: IMPORT_STEP_LABELS.storage_upload,
      supabase: storage.cloudflare,
      context: {
        step: "storage_upload",
        bucket: error.context.bucket,
        storagePath: error.context.key,
        fileSizeBytes: error.context.fileSizeBytes,
        contentType: error.context.contentType,
        fileName: error.context.fileName,
        sessionId: error.context.sessionId,
        documentId: error.context.documentId,
        extra: {
          provider: error.provider,
          operation: error.operation,
          userId: error.context.userId,
        },
      },
      storage,
    };
  }

  const inspected = logInspectedError("[import-pipeline] Erreur non typée", error);
  return {
    error: inspected.message,
    supabase: inspected.json,
  };
}

export { getExactErrorMessage, inspectError };
