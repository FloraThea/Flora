export { storageService, StorageService, readDocumentStorageProvider } from "./StorageService";
export {
  getStorageProviderName,
  getR2Config,
  tryGetR2Config,
  getMissingR2EnvVars,
  formatMissingR2EnvMessage,
  getSignedUrlTtlSeconds,
  R2_ENV_KEYS,
} from "./config";
export type { R2Config, StorageProviderName, R2EnvKey } from "./config";
export {
  readR2EnvValue,
  readR2EnvSnapshot,
  getR2BucketNameFromEnv,
  detectLegacyR2EnvAliases,
} from "./r2-env";
export {
  buildDocumentStorageKey,
  buildTempMultipartPartKey,
  inferDocumentCategory,
  sanitizeFilename,
} from "./path-builder";
export type { DocumentStorageCategory } from "./types";
export type {
  StorageProvider,
  StorageUploadInput,
  StorageUploadResult,
  StorageDownloadResult,
  StorageObjectMetadata,
  StorageListResult,
  StorageSignedUrlOptions,
  MultipartUploadInitResult,
  MultipartPartResult,
  MultipartCompletePart,
  StorageOperationContext,
} from "./types";
export { getR2EnvPresence, buildImportStorageDiagnostics, logImportRouteContext, buildR2Diagnostics, logR2Diagnostics } from "./r2-diagnostics";
export type { R2EnvPresence } from "./r2-diagnostics";
