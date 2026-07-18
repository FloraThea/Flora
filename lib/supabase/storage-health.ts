import { floraDb } from "@/lib/supabase/get-db";
import { getStorageBucketName } from "./storage-config";

export type StorageBucketHealth = {
  bucket: string;
  exists: boolean;
  checkedAt: string;
  message: string;
};

let lastHealthCheck: StorageBucketHealth | null = null;

function isBucketNotFoundError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("bucket not found") ||
    normalized.includes("bucket introuvable") ||
    normalized.includes("does not exist")
  );
}

export async function checkStorageBucketExists(
  bucketName: string = getStorageBucketName(),
): Promise<boolean> {
  const { data, error } = await (await floraDb()).storage.from(bucketName).list("", {
    limit: 1,
  });

  if (!error) {
    return true;
  }

  if (isBucketNotFoundError(error.message)) {
    return false;
  }

  const { data: buckets, error: listError } = await (await floraDb()).storage.listBuckets();

  if (!listError && buckets) {
    return buckets.some((bucket) => bucket.id === bucketName || bucket.name === bucketName);
  }

  console.warn("[storage-health] Vérification bucket ambiguë", {
    bucket: bucketName,
    probeError: error.message,
    listError: listError?.message ?? null,
  });

  return false;
}

export async function getStorageBucketHealth(
  bucketName: string = getStorageBucketName(),
): Promise<StorageBucketHealth> {
  const exists = await checkStorageBucketExists(bucketName);
  const health: StorageBucketHealth = {
    bucket: bucketName,
    exists,
    checkedAt: new Date().toISOString(),
    message: exists
      ? `Bucket Supabase « ${bucketName} » disponible.`
      : `Bucket Supabase « ${bucketName} » introuvable. Les imports BO restent possibles sans archivage PDF.`,
  };

  lastHealthCheck = health;
  return health;
}

export function getLastStorageBucketHealth(): StorageBucketHealth | null {
  return lastHealthCheck;
}

export async function logStorageBucketHealth(): Promise<void> {
  const health = await getStorageBucketHealth();

  if (health.exists) {
    console.info("[storage-health] Bucket OK", {
      bucket: health.bucket,
    });
    return;
  }

  console.warn("[storage-health] Bucket manquant", {
    bucket: health.bucket,
    hint: "Créez le bucket via `npx (await floraDb()) db push` ou le dashboard Supabase Storage.",
    envVar: "NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET",
  });
}
