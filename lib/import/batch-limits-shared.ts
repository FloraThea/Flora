/** Limites communes pour tous les imports multi-fichiers Flora. */
export const SHARED_IMPORT_BATCH_LIMITS = {
  maxFiles: 20,
  maxFileSizeBytes: 25 * 1024 * 1024,
  maxTotalSizeBytes: 100 * 1024 * 1024,
} as const;

export function formatSharedBatchLimitsLabel(): string {
  const { maxFiles, maxFileSizeBytes, maxTotalSizeBytes } = SHARED_IMPORT_BATCH_LIMITS;
  return `Jusqu'à ${maxFiles} fichiers · ${Math.round(maxFileSizeBytes / (1024 * 1024))} Mo/fichier · ${Math.round(maxTotalSizeBytes / (1024 * 1024))} Mo total`;
}
