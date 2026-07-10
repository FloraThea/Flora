import "server-only";

import { devLog, logError } from "@/lib/logger";
import {
  formatMissingR2EnvMessage,
  getMissingR2EnvVars,
  getStorageProviderName,
  tryGetR2Config,
} from "./config";
import { R2_S3_CLIENT_OPTIONS } from "./r2-client";
import {
  detectLegacyR2EnvAliases,
  getR2BucketNameFromEnv,
  getR2EnvPresence,
  readR2EnvSnapshot,
  R2_ENV_KEYS,
} from "./r2-env";
import {
  formatR2CredentialIssues,
  maskSecret,
  validateR2Credentials,
} from "./r2-validation";

export type R2EnvPresence = Record<(typeof R2_ENV_KEYS)[number], "present" | "missing">;

export { getR2EnvPresence, R2_ENV_KEYS };

export function buildR2Diagnostics() {
  const missing = getMissingR2EnvVars();
  const r2Config = tryGetR2Config();
  const env = readR2EnvSnapshot();
  const legacyEnvWarnings = detectLegacyR2EnvAliases();

  const credentialIssues =
    missing.length === 0
      ? validateR2Credentials({
          accountId: env.accountId,
          accessKeyId: env.accessKeyId,
          secretAccessKey: env.secretAccessKey,
          endpoint: env.endpoint,
        })
      : [];

  return {
    provider: getStorageProviderName(),
    r2Env: getR2EnvPresence(),
    missingEnv: missing,
    missingEnvMessage: missing.length > 0 ? formatMissingR2EnvMessage(missing) : null,
    legacyEnvWarnings,
    credentialIssues,
    credentialError:
      credentialIssues.length > 0 ? formatR2CredentialIssues(credentialIssues) : null,
    accountId: env.accountId || r2Config?.accountId || null,
    endpoint: env.endpoint || r2Config?.endpoint || null,
    bucket: getR2BucketNameFromEnv() ?? r2Config?.bucketName ?? null,
    bucketEnvKey: "CLOUDFLARE_R2_BUCKET_NAME",
    region: R2_S3_CLIENT_OPTIONS.region,
    forcePathStyle: R2_S3_CLIENT_OPTIONS.forcePathStyle,
    signatureVersion: R2_S3_CLIENT_OPTIONS.signatureVersion,
    credentialType: "r2_s3_access_key",
    accessKeyIdPreview: env.accessKeyId ? maskSecret(env.accessKeyId) : null,
    secretAccessKeyPreview: env.secretAccessKey ? maskSecret(env.secretAccessKey) : null,
    configValidated: Boolean(r2Config),
    restartHint:
      missing.length > 0
        ? "Si vous venez d'ajouter les variables dans .env.local, redémarrez le serveur Next.js (npm run dev)."
        : null,
  };
}

export function buildImportStorageDiagnostics(input?: {
  fileName?: string;
  fileSizeBytes?: number;
  storageKey?: string;
  contentType?: string;
  userId?: string;
}) {
  const base = buildR2Diagnostics();

  return {
    ...base,
    storageKey: input?.storageKey ?? null,
    fileName: input?.fileName ?? null,
    fileSizeBytes: input?.fileSizeBytes ?? null,
    contentType: input?.contentType ?? null,
    userId: input?.userId ?? null,
  };
}

export function logImportRouteContext(
  subpath: string,
  phase: "start" | "error",
  input?: Parameters<typeof buildImportStorageDiagnostics>[0],
  error?: unknown,
): ReturnType<typeof buildImportStorageDiagnostics> {
  const diagnostics = buildImportStorageDiagnostics(input);
  const label = `[import${subpath}]`;

  if (phase === "start") {
    devLog(`${label} Contexte storage`, diagnostics);
    return diagnostics;
  }

  logError(`${label} Échec storage`, {
    ...diagnostics,
    error,
    errorMessage: error instanceof Error ? error.message : String(error),
  });

  return diagnostics;
}

export function logR2Diagnostics(context = "[r2]"): void {
  devLog(`${context} Diagnostic configuration`, buildR2Diagnostics());
}
