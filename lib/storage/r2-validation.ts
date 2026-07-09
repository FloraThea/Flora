import "server-only";

/** Format attendu d'un Account ID Cloudflare (32 caractères hexadécimaux). */
const ACCOUNT_ID_PATTERN = /^[a-f0-9]{32}$/i;

/** Access Key ID R2 S3-compatible (32 caractères hexadécimaux). */
const R2_ACCESS_KEY_PATTERN = /^[a-f0-9]{32}$/i;

/** Secret Access Key R2 S3-compatible (64 caractères hexadécimaux). */
const R2_SECRET_KEY_PATTERN = /^[a-f0-9]{64}$/i;

/** Préfixes typiques d'un API Token Cloudflare (incompatible S3). */
const CLOUDFLARE_API_TOKEN_PREFIXES = ["cfat_", "v1.0-", "Bearer "];

export type R2CredentialIssue = {
  field: string;
  severity: "error" | "warning";
  message: string;
};

export function buildR2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

export function looksLikeCloudflareApiToken(value: string): boolean {
  const trimmed = value.trim();
  return CLOUDFLARE_API_TOKEN_PREFIXES.some((prefix) =>
    trimmed.toLowerCase().startsWith(prefix.toLowerCase()),
  );
}

export function validateR2Credentials(input: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
}): R2CredentialIssue[] {
  const issues: R2CredentialIssue[] = [];

  if (looksLikeCloudflareApiToken(input.accountId)) {
    issues.push({
      field: "CLOUDFLARE_R2_ACCOUNT_ID",
      severity: "error",
      message:
        "La valeur ressemble à un API Token Cloudflare (cfat_…), pas à un Account ID. " +
        "Utilisez l'Account ID (32 caractères hex) visible dans R2 → Overview, " +
        "et des identifiants S3 R2 (Access Key ID + Secret Access Key) créés via « Manage R2 API Tokens ».",
    });
  } else if (!ACCOUNT_ID_PATTERN.test(input.accountId)) {
    issues.push({
      field: "CLOUDFLARE_R2_ACCOUNT_ID",
      severity: "error",
      message:
        `Account ID invalide (${input.accountId.length} caractères). ` +
        "Attendu : 32 caractères hexadécimaux (ex. af1f8d1c0b968a7221d52ca162171c78).",
    });
  }

  if (looksLikeCloudflareApiToken(input.accessKeyId)) {
    issues.push({
      field: "CLOUDFLARE_R2_ACCESS_KEY_ID",
      severity: "error",
      message:
        "La valeur ressemble à un API Token Cloudflare. " +
        "Utilisez l'Access Key ID S3 (32 caractères hex) généré avec le token R2.",
    });
  } else if (!R2_ACCESS_KEY_PATTERN.test(input.accessKeyId)) {
    issues.push({
      field: "CLOUDFLARE_R2_ACCESS_KEY_ID",
      severity: "error",
      message:
        `Access Key ID invalide (${input.accessKeyId.length} caractères). ` +
        "Attendu : 32 caractères hexadécimaux (identifiant S3 R2, pas un token Bearer).",
    });
  }

  if (looksLikeCloudflareApiToken(input.secretAccessKey)) {
    issues.push({
      field: "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      severity: "error",
      message:
        "La valeur ressemble à un API Token Cloudflare. " +
        "Utilisez le Secret Access Key S3 (64 caractères hex) affiché une seule fois à la création du token R2.",
    });
  } else if (!R2_SECRET_KEY_PATTERN.test(input.secretAccessKey)) {
    issues.push({
      field: "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
      severity: "error",
      message:
        `Secret Access Key invalide (${input.secretAccessKey.length} caractères). ` +
        "Attendu : 64 caractères hexadécimaux. La clé semble tronquée — recopiez-la depuis le dashboard Cloudflare.",
    });
  }

  if (input.endpoint) {
    const expected = buildR2Endpoint(input.accountId);
    const normalizedEndpoint = input.endpoint.replace(/\/+$/, "");
    const normalizedExpected = expected.replace(/\/+$/, "");

    if (
      ACCOUNT_ID_PATTERN.test(input.accountId) &&
      normalizedEndpoint !== normalizedExpected
    ) {
      issues.push({
        field: "CLOUDFLARE_R2_ENDPOINT",
        severity: "warning",
        message:
          `Endpoint incohérent avec l'Account ID. Attendu : ${normalizedExpected}. ` +
          `Reçu : ${normalizedEndpoint}. L'endpoint sera recalculé automatiquement.`,
      });
    }
  }

  return issues;
}

export function formatR2CredentialIssues(issues: R2CredentialIssue[]): string {
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length === 0) return "";
  return errors.map((i) => `[${i.field}] ${i.message}`).join(" ");
}

export function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)} (${value.length} car.)`;
}
