import type { ImportJob } from "./types";
import { IMPORT_CONFIG } from "./config";

const ACTIVE_STATUSES = new Set<ImportJob["status"]>([
  "extracting",
  "ocr",
  "analyzing",
  "indexing",
]);

export function isImportJobStale(job: ImportJob, now = Date.now()): boolean {
  if (!ACTIVE_STATUSES.has(job.status)) return false;
  const updatedAt = Date.parse(job.updatedAt);
  if (!Number.isFinite(updatedAt)) return false;
  return now - updatedAt > IMPORT_CONFIG.staleJobTimeoutMinutes * 60_000;
}

export function isImportJobActivelyRunning(job: ImportJob, now = Date.now()): boolean {
  return ACTIVE_STATUSES.has(job.status) && !isImportJobStale(job, now);
}
