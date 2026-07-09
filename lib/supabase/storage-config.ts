/**
 * Bucket Supabase Storage utilisé pour archiver PDF/ressources et BO.
 * Limite fichier : MAX_UPLOAD_SIZE (500 Mo par défaut) — voir lib/upload/max-upload-size.ts
 * Surchargeable via NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET.
 */
import { MAX_UPLOAD_SIZE } from "@/lib/upload/max-upload-size";

export { MAX_UPLOAD_SIZE };
export const DEFAULT_STORAGE_BUCKET = "resources";

export function getStorageBucketName(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET?.trim() ||
    process.env.SUPABASE_STORAGE_BUCKET?.trim() ||
    DEFAULT_STORAGE_BUCKET
  );
}

export function getBoStoragePrefix(): string {
  return "bo";
}

export function buildBoStoragePath(filename: string): string {
  const safeName = filename.replace(/[^\w.\- ]+/g, "_");
  return `${getBoStoragePrefix()}/${Date.now()}-${safeName}`;
}

export function get108hStoragePrefix(profileId: string): string {
  return `108h/${profileId}`;
}

export function build108hStoragePath(profileId: string, filename: string): string {
  const safeName = filename.replace(/[^\w.\- ]+/g, "_");
  return `${get108hStoragePrefix(profileId)}/${Date.now()}-${safeName}`;
}

export function buildProgrammationStoragePath(profileId: string, filename: string): string {
  const safeName = filename.replace(/[^\w.\- ]+/g, "_");
  return `programmations/${profileId}/${Date.now()}-${safeName}`;
}
