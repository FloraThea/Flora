import "server-only";

import {
  formatR2CredentialIssues,
  validateR2Credentials,
} from "./r2-validation";
import {
  detectLegacyR2EnvAliases,
  getMissingR2EnvKeys,
  readR2EnvSnapshot,
  R2_ENV_KEYS,
  type R2EnvKey,
} from "./r2-env";

export { R2_ENV_KEYS, type R2EnvKey };

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
  region: "auto";
};

export type StorageProviderName = "cloudflare_r2" | "supabase";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

export function getSignedUrlTtlSeconds(): number {
  const raw = process.env.FLORA_STORAGE_SIGNED_URL_TTL_SECONDS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_SIGNED_URL_TTL_SECONDS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SIGNED_URL_TTL_SECONDS;
}

export function getStorageProviderName(): StorageProviderName {
  const raw = process.env.FLORA_STORAGE_PROVIDER?.trim().toLowerCase();
  if (raw === "supabase") return "supabase";
  return "cloudflare_r2";
}

export function getMissingR2EnvVars(): R2EnvKey[] {
  return getMissingR2EnvKeys();
}

export function formatMissingR2EnvMessage(missing: R2EnvKey[]): string {
  if (missing.length === 0) return "";
  const legacy = detectLegacyR2EnvAliases();
  return (
    `Configuration Cloudflare R2 incomplète. Variable(s) manquante(s) : ${missing.join(", ")}. ` +
    `Ajoutez-les dans .env.local (côté serveur uniquement, jamais NEXT_PUBLIC_). ` +
    `Utilisez des identifiants S3 R2 (Access Key ID + Secret Access Key), pas un API Token Cloudflare.` +
    (legacy.length > 0 ? ` Anciennes variables détectées : ${legacy.join(" ")}` : "")
  );
}

export function getR2Config(): R2Config {
  const missing = getMissingR2EnvKeys();
  if (missing.length > 0) {
    throw new Error(formatMissingR2EnvMessage(missing));
  }

  const env = readR2EnvSnapshot();

  const credentialIssues = validateR2Credentials({
    accountId: env.accountId,
    accessKeyId: env.accessKeyId,
    secretAccessKey: env.secretAccessKey,
    endpoint: env.endpoint,
  });

  const credentialError = formatR2CredentialIssues(credentialIssues);
  if (credentialError) {
    throw new Error(`Configuration Cloudflare R2 invalide. ${credentialError}`);
  }

  return {
    accountId: env.accountId,
    accessKeyId: env.accessKeyId,
    secretAccessKey: env.secretAccessKey,
    bucketName: env.bucketName,
    endpoint: env.endpoint,
    region: "auto",
  };
}

export function tryGetR2Config(): R2Config | null {
  try {
    return getR2Config();
  } catch {
    return null;
  }
}
