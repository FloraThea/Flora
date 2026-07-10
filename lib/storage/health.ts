import "server-only";

import { devLog, logWarn } from "@/lib/logger";
import {
  formatMissingR2EnvMessage,
  getMissingR2EnvVars,
  getStorageProviderName,
  tryGetR2Config,
} from "./config";
import { getR2BucketNameFromEnv } from "./r2-env";
import { storageService } from "./StorageService";
import { cloudflareR2Provider } from "./providers/CloudflareR2Provider";
import { supabaseStorageProvider } from "./providers/SupabaseStorageProvider";

export type StorageHealthReport = {
  provider: string;
  ok: boolean;
  bucket: string | null;
  message: string;
  missingEnv?: string[];
};

function resolveR2BucketName(): string | null {
  return getR2BucketNameFromEnv() ?? tryGetR2Config()?.bucketName ?? null;
}

export async function getStorageHealth(): Promise<StorageHealthReport> {
  const provider = getStorageProviderName();

  if (provider === "cloudflare_r2") {
    const missing = getMissingR2EnvVars();
    const bucket = resolveR2BucketName();

    if (missing.length > 0) {
      return {
        provider,
        ok: false,
        bucket,
        missingEnv: [...missing],
        message: formatMissingR2EnvMessage(missing),
      };
    }

    try {
      await storageService.list("documents/", { maxKeys: 1 }, "cloudflare_r2");
      return {
        provider,
        ok: true,
        bucket,
        message: `Cloudflare R2 « ${bucket} » accessible.`,
      };
    } catch (error) {
      return {
        provider,
        ok: false,
        bucket,
        message: error instanceof Error ? error.message : "Connexion R2 impossible.",
      };
    }
  }

  const { getStorageBucketHealth } = await import("@/lib/supabase/storage-health");
  const legacy = await getStorageBucketHealth();
  return {
    provider: "supabase",
    ok: legacy.exists,
    bucket: legacy.bucket,
    message: legacy.message,
  };
}

export async function logStorageHealth(): Promise<void> {
  const health = await getStorageHealth();

  if (health.ok) {
    devLog("[storage-health] OK", {
      provider: health.provider,
      bucket: health.bucket,
    });
    return;
  }

  logWarn("[storage-health] Problème", health);
}

export { cloudflareR2Provider, supabaseStorageProvider };
