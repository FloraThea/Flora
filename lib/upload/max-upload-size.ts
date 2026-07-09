/**
 * Limite globale unique pour tous les uploads Flora (front, API, Supabase Storage).
 * Surchargeable via FLORA_MAX_UPLOAD_BYTES (octets).
 */
const envLimit = process.env.FLORA_MAX_UPLOAD_BYTES?.trim();
const parsedEnv = envLimit ? Number.parseInt(envLimit, 10) : Number.NaN;

export const MAX_UPLOAD_SIZE =
  Number.isFinite(parsedEnv) && parsedEnv > 0
    ? parsedEnv
    : 500 * 1024 * 1024;

/** Alias explicites — ne pas redéfinir ailleurs. */
export const MAX_FILE_SIZE = MAX_UPLOAD_SIZE;
export const STORAGE_LIMIT = MAX_UPLOAD_SIZE;
export const PAYLOAD_LIMIT = MAX_UPLOAD_SIZE;
export const BODY_LIMIT = MAX_UPLOAD_SIZE;

export function getMaxUploadSizeMb(): number {
  return Math.round(MAX_UPLOAD_SIZE / (1024 * 1024));
}
