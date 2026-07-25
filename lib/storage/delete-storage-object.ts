import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { getStorageBucketName } from "@/lib/supabase/storage-config";
import { readDocumentStorageProvider, storageService } from "./StorageService";

/**
 * Supprime un objet de stockage (R2 ou Supabase legacy) à partir de son chemin et métadonnées.
 */
export async function deleteStorageObject(input: {
  storagePath: string;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const path = input.storagePath.trim();
  if (!path) return;

  const provider = readDocumentStorageProvider(input.metadata ?? null);

  try {
    await storageService.delete(path, undefined, provider);
    return;
  } catch (error) {
    console.warn("[storage] Suppression via provider principal échouée, repli Supabase", {
      path,
      provider,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  await (await floraDb())
    .storage.from(getStorageBucketName())
    .remove([path])
    .catch(() => undefined);
}
