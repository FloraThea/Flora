/** Seuil au-delà duquel l'upload direct (URL signée R2) est préféré à l'API. */
export const PROGRAMMING_IMPORT_DIRECT_UPLOAD_THRESHOLD_BYTES = 4 * 1024 * 1024;

/** Limite corps requête API (alignée sur next.config proxyClientMaxBodySize). */
export const PROGRAMMING_IMPORT_API_BODY_LIMIT_BYTES = 28 * 1024 * 1024;

/** Limites centralisées pour l'import programmation multi-fichiers. */
export const PROGRAMMATION_IMPORT_BATCH_LIMITS = {
  maxFiles: 20,
  maxFileBytes: 25 * 1024 * 1024,
  maxTotalBytes: 100 * 1024 * 1024,
} as const;

export function formatBatchLimitsLabel(): string {
  const { maxFiles, maxFileBytes, maxTotalBytes } = PROGRAMMATION_IMPORT_BATCH_LIMITS;
  return `Vous pouvez importer jusqu'à ${maxFiles} pages, ${Math.round(maxFileBytes / (1024 * 1024))} Mo par fichier, ${Math.round(maxTotalBytes / (1024 * 1024))} Mo au total. Les fichiers lourds sont téléversés directement vers le stockage.`;
}
