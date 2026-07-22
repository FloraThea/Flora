/**
 * Configuration import documentaire — la limite globale est MAX_UPLOAD_SIZE.
 */

import {
  MAX_UPLOAD_SIZE,
  getMaxUploadSizeMb,
} from "@/lib/upload/max-upload-size";

function readInt(envKey: string, fallback: number): number {
  const raw = process.env[envKey]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBool(envKey: string, fallback: boolean): boolean {
  const raw = process.env[envKey]?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes";
}

const MB = 1024 * 1024;

export { MAX_UPLOAD_SIZE, getMaxUploadSizeMb };

export const IMPORT_CONFIG = {
  /** Limite unique — identique partout (front, API, Storage). */
  maxUploadSizeBytes: MAX_UPLOAD_SIZE,

  /** Taille d'un chunk d'upload (octets) */
  chunkSizeBytes: readInt("FLORA_IMPORT_CHUNK_SIZE_BYTES", 5 * MB),

  /** Seuil en dessous duquel l'upload direct est autorisé (sans chunks) */
  directUploadThresholdBytes: readInt("FLORA_IMPORT_DIRECT_THRESHOLD_BYTES", 10 * MB),

  /** Durée de validité d'une session d'upload (heures) */
  sessionTtlHours: readInt("FLORA_IMPORT_SESSION_TTL_HOURS", 24),

  /** Nombre max de fichiers en parallèle dans la file */
  maxParallelJobs: readInt("FLORA_IMPORT_MAX_PARALLEL_JOBS", 2),

  /** Intervalle de polling client (ms) */
  pollIntervalMs: readInt("FLORA_IMPORT_POLL_INTERVAL_MS", 2000),

  /** OCR */
  ocr: {
    enabled: readBool("FLORA_IMPORT_OCR_ENABLED", true),
    maxPages: readInt("FLORA_IMPORT_OCR_MAX_PAGES", 120),
  },

  /** Indexation */
  indexing: {
    segmentMinChars: readInt("FLORA_IMPORT_SEGMENT_MIN_CHARS", 400),
    segmentMaxChars: readInt("FLORA_IMPORT_SEGMENT_MAX_CHARS", 2400),
  },

  /** Notifications */
  notifications: {
    enabled: readBool("FLORA_IMPORT_NOTIFICATIONS_ENABLED", true),
  },

  /** Retry Gemini (503) */
  gemini: {
    retryAttempts: readInt("FLORA_GEMINI_RETRY_ATTEMPTS", 4),
    retryDelayMs: readInt("FLORA_GEMINI_RETRY_DELAY_MS", 10_000),
    deferredRetryMinutes: readInt("FLORA_GEMINI_DEFERRED_RETRY_MINUTES", 3),
    maxDeferredRetries: readInt("FLORA_GEMINI_MAX_DEFERRED_RETRIES", 5),
  },

  /** Jobs bloqués en extracting/analyzing/indexing au-delà de ce délai sont relancés */
  staleJobTimeoutMinutes: readInt("FLORA_IMPORT_STALE_JOB_TIMEOUT_MINUTES", 8),
} as const;

export type ImportFileKind = "pdf" | "docx" | "xlsx" | "pptx" | "txt" | "default";

export function resolveImportFileKind(extension: string): ImportFileKind {
  switch (extension.toLowerCase()) {
    case ".pdf":
      return "pdf";
    case ".docx":
      return "docx";
    case ".xlsx":
      return "xlsx";
    case ".pptx":
      return "pptx";
    case ".txt":
      return "txt";
    default:
      return "default";
  }
}

/** Tous les formats acceptés partagent la même limite globale. */
export function getMaxFileSizeForExtension(_extension?: string): number {
  return MAX_UPLOAD_SIZE;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} Ko`;
  if (bytes < 1024 * MB) return `${(bytes / MB).toFixed(1)} Mo`;
  return `${(bytes / (1024 * MB)).toFixed(2)} Go`;
}

export function computeChunkCount(fileSize: number): number {
  return Math.max(1, Math.ceil(fileSize / IMPORT_CONFIG.chunkSizeBytes));
}

export function validateUploadFileSize(fileSize: number, filename?: string): void {
  if (fileSize <= 0) {
    throw new Error("Fichier vide.");
  }
  if (fileSize > MAX_UPLOAD_SIZE) {
    throw new Error(
      `Fichier trop volumineux${filename ? ` (${filename})` : ""} : ${formatBytes(fileSize)}. ` +
        `Limite autorisée : ${formatBytes(MAX_UPLOAD_SIZE)}.`,
    );
  }
}
