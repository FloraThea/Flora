import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { getR2Config } from "./config";
import { maskSecret } from "./r2-validation";

export const R2_S3_CLIENT_OPTIONS = {
  region: "auto" as const,
  forcePathStyle: false as const,
  signatureVersion: "v4" as const,
};

let cachedClient: S3Client | null = null;
let cachedConfigKey: string | null = null;

function buildConfigKey(config: ReturnType<typeof getR2Config>): string {
  return `${config.accountId}:${config.accessKeyId}:${config.secretAccessKey.length}:${config.endpoint}`;
}

export function logR2ClientConfig(config: ReturnType<typeof getR2Config>): void {
  console.info("[r2] Configuration client S3", {
    accountId: config.accountId,
    endpoint: config.endpoint,
    bucket: config.bucketName,
    region: R2_S3_CLIENT_OPTIONS.region,
    forcePathStyle: R2_S3_CLIENT_OPTIONS.forcePathStyle,
    signatureVersion: R2_S3_CLIENT_OPTIONS.signatureVersion,
    accessKeyId: maskSecret(config.accessKeyId),
    secretAccessKey: maskSecret(config.secretAccessKey),
    credentialType: "r2_s3_access_key",
  });
}

export function getR2S3Client(): S3Client {
  const config = getR2Config();
  const configKey = buildConfigKey(config);

  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  logR2ClientConfig(config);

  cachedClient = new S3Client({
    region: R2_S3_CLIENT_OPTIONS.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: R2_S3_CLIENT_OPTIONS.forcePathStyle,
  });
  cachedConfigKey = configKey;

  return cachedClient;
}

export function resetR2S3ClientCache(): void {
  cachedClient = null;
  cachedConfigKey = null;
}
