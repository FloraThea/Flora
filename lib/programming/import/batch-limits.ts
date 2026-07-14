/** Limites centralisées pour l'import programmation multi-fichiers. */
export const PROGRAMMATION_IMPORT_BATCH_LIMITS = {
  maxFiles: 20,
  maxFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 100 * 1024 * 1024,
} as const;

export function formatBatchLimitsLabel(): string {
  const { maxFiles, maxFileBytes, maxTotalBytes } = PROGRAMMATION_IMPORT_BATCH_LIMITS;
  return `Vous pouvez importer jusqu'à ${maxFiles} pages, ${Math.round(maxFileBytes / (1024 * 1024))} Mo par fichier, ${Math.round(maxTotalBytes / (1024 * 1024))} Mo au total.`;
}
