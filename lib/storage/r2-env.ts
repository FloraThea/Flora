import "server-only";

/**
 * Noms exacts des variables d'environnement Cloudflare R2.
 * Ne pas utiliser R2_BUCKET_NAME, BUCKET_NAME, etc.
 */
export const R2_ENV_KEYS = [
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET_NAME",
  "CLOUDFLARE_R2_ENDPOINT",
] as const;

export type R2EnvKey = (typeof R2_ENV_KEYS)[number];

const LEGACY_ENV_ALIASES: Record<string, R2EnvKey> = {
  R2_ACCOUNT_ID: "CLOUDFLARE_R2_ACCOUNT_ID",
  R2_ACCESS_KEY_ID: "CLOUDFLARE_R2_ACCESS_KEY_ID",
  R2_SECRET_ACCESS_KEY: "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  R2_BUCKET_NAME: "CLOUDFLARE_R2_BUCKET_NAME",
  BUCKET_NAME: "CLOUDFLARE_R2_BUCKET_NAME",
  R2_ENDPOINT: "CLOUDFLARE_R2_ENDPOINT",
  CLOUDFLARE_ACCOUNT_ID: "CLOUDFLARE_R2_ACCOUNT_ID",
};

export type R2EnvSnapshot = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  endpoint: string;
};

export function readR2EnvValue(key: R2EnvKey): string {
  switch (key) {
    case "CLOUDFLARE_R2_ACCOUNT_ID":
      return process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim() ?? "";
    case "CLOUDFLARE_R2_ACCESS_KEY_ID":
      return process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim() ?? "";
    case "CLOUDFLARE_R2_SECRET_ACCESS_KEY":
      return process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim() ?? "";
    case "CLOUDFLARE_R2_BUCKET_NAME":
      return process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim() ?? "";
    case "CLOUDFLARE_R2_ENDPOINT":
      return process.env.CLOUDFLARE_R2_ENDPOINT?.trim() ?? "";
    default: {
      const exhaustive: never = key;
      return exhaustive;
    }
  }
}

export function readR2EnvSnapshot(): R2EnvSnapshot {
  return {
    accountId: readR2EnvValue("CLOUDFLARE_R2_ACCOUNT_ID"),
    accessKeyId: readR2EnvValue("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: readR2EnvValue("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    bucketName: readR2EnvValue("CLOUDFLARE_R2_BUCKET_NAME"),
    endpoint: readR2EnvValue("CLOUDFLARE_R2_ENDPOINT").replace(/\/+$/, ""),
  };
}

export function getR2BucketNameFromEnv(): string | null {
  const bucket = readR2EnvValue("CLOUDFLARE_R2_BUCKET_NAME");
  return bucket || null;
}

export function getMissingR2EnvKeys(): R2EnvKey[] {
  return R2_ENV_KEYS.filter((key) => !readR2EnvValue(key));
}

export function getR2EnvPresence(): Record<R2EnvKey, "present" | "missing"> {
  return Object.fromEntries(
    R2_ENV_KEYS.map((key) => [key, readR2EnvValue(key) ? "present" : "missing"]),
  ) as Record<R2EnvKey, "present" | "missing">;
}

export function detectLegacyR2EnvAliases(): string[] {
  const warnings: string[] = [];

  for (const [legacyKey, canonicalKey] of Object.entries(LEGACY_ENV_ALIASES)) {
    if (process.env[legacyKey]?.trim() && !readR2EnvValue(canonicalKey)) {
      warnings.push(
        `${legacyKey} est défini mais ignoré — utilisez ${canonicalKey}.`,
      );
    }
  }

  return warnings;
}
