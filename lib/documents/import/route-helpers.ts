import { NextResponse } from "next/server";
import { jsonRouteError } from "@/lib/api/route-diagnostics";
import { buildImportStorageDiagnostics, logImportRouteContext } from "@/lib/storage/r2-diagnostics";
import { duplicateDetector } from "@/lib/documents/import/DuplicateDetector";
import { importQueue } from "@/lib/documents/import/ImportQueue";
import {
  importErrorToApiPayload,
  type ImportPipelineStep,
} from "@/lib/documents/import/import-error-diagnostics";
import { notificationManager } from "@/lib/documents/import/NotificationManager";
import { uploadManager } from "@/lib/documents/import/UploadManager";
import type { DuplicateResolution } from "@/lib/documents/import/types";

export const ROUTE_IMPORT = "/api/documents/import";

export function importRouteError(
  subpath: string,
  status: number,
  error: string,
  details?: string,
  extra?: Record<string, unknown>,
  cause?: unknown,
) {
  return jsonRouteError(`${ROUTE_IMPORT}${subpath}`, status, error, details, extra, cause);
}

export async function buildImportStatusPayload(input: {
  sessionId?: string | null;
  documentId?: string | null;
  jobId?: string | null;
}) {
  const session = input.sessionId ? await uploadManager.getSession(input.sessionId) : null;
  const job = input.jobId
    ? await importQueue.getJob(input.jobId)
    : input.documentId
      ? await importQueue.getJobForDocument(input.documentId)
      : null;

  let document = null;
  if (input.documentId || job?.documentId) {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase
      .from("documents")
      .select("*")
      .eq("id", input.documentId ?? job?.documentId)
      .maybeSingle();
    document = data;
  }

  const notifications = await notificationManager.listUnread(10);

  return {
    session,
    job,
    document,
    notifications,
  };
}

export async function resolveDuplicateUpload(body: {
  sessionId: string;
  resolution: DuplicateResolution;
  checksum?: string;
}) {
  return uploadManager.completeUpload({
    sessionId: body.sessionId,
    checksum: body.checksum,
    duplicateResolution: body.resolution,
  });
}

export function handleImportRouteError(
  subpath: string,
  error: unknown,
  step?: ImportPipelineStep,
  context?: {
    fileName?: string;
    fileSizeBytes?: number;
    storageKey?: string;
    contentType?: string;
    userId?: string;
  },
) {
  const payload = importErrorToApiPayload(error);
  const storageDiagnostics = logImportRouteContext(subpath, "error", context, error);

  return importRouteError(
    subpath,
    500,
    payload.error,
    payload.supabase,
    {
      step: payload.step ?? step,
      stepLabel: payload.stepLabel,
      context: payload.context,
      storage: payload.storage,
      r2Env: storageDiagnostics.r2Env,
      missingEnv: payload.missingEnv ?? storageDiagnostics.missingEnv,
      restartHint: storageDiagnostics.restartHint,
      bucket: storageDiagnostics.bucket,
      endpoint: storageDiagnostics.endpoint,
      storageKey: storageDiagnostics.storageKey ?? context?.storageKey,
    },
    error,
  );
}

export function logImportRouteStart(
  subpath: string,
  context?: {
    fileName?: string;
    fileSizeBytes?: number;
    storageKey?: string;
    contentType?: string;
    userId?: string;
  },
) {
  return logImportRouteContext(subpath, "start", context);
}

export function importJsonSuccess<T extends Record<string, unknown>>(payload: T) {
  return NextResponse.json({ success: true, ...payload });
}

export async function findDuplicateCandidates(sessionId: string) {
  const session = await uploadManager.getSession(sessionId);
  if (!session) return [];
  return duplicateDetector.findDuplicates({
    filename: session.originalFilename,
    fileSize: session.fileSize,
  });
}
