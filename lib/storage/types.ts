import type { StorageProviderName } from "./config";

export type DocumentStorageCategory =
  | "guides"
  | "bo"
  | "programmations"
  | "progressions"
  | "evaluations"
  | "albums"
  | "images"
  | "archives";

export type StorageUploadInput = {
  key: string;
  body: Buffer | Uint8Array | Blob | ArrayBuffer;
  contentType?: string;
  metadata?: Record<string, string>;
  userId?: string;
  fileName?: string;
};

export type StorageUploadResult = {
  provider: StorageProviderName;
  bucket: string;
  key: string;
  fileSizeBytes: number;
  contentType: string;
  etag?: string;
};

export type StorageDownloadResult = {
  body: Buffer;
  contentType: string;
  contentLength: number;
  etag?: string;
};

export type StorageObjectMetadata = {
  key: string;
  bucket: string;
  contentType: string;
  contentLength: number;
  etag?: string;
  lastModified?: Date;
};

export type StorageListResult = {
  keys: string[];
  prefixes: string[];
  isTruncated: boolean;
};

export type StorageSignedUrlOptions = {
  expiresInSeconds?: number;
  contentType?: string;
  contentDisposition?: string;
};

export type MultipartUploadInitResult = {
  uploadId: string;
  key: string;
  bucket: string;
};

export type MultipartPartResult = {
  partNumber: number;
  etag: string;
};

export type MultipartCompletePart = {
  partNumber: number;
  etag: string;
};

export type StorageOperationContext = {
  userId?: string;
  sessionId?: string;
  documentId?: string;
  fileName?: string;
  operation?: string;
};

export interface StorageProvider {
  readonly name: StorageProviderName;

  upload(input: StorageUploadInput, context?: StorageOperationContext): Promise<StorageUploadResult>;
  download(key: string, context?: StorageOperationContext): Promise<StorageDownloadResult>;
  delete(key: string, context?: StorageOperationContext): Promise<void>;
  exists(key: string, context?: StorageOperationContext): Promise<boolean>;
  getSignedUrl(key: string, options?: StorageSignedUrlOptions): Promise<string>;
  /** URL signée PUT pour upload direct navigateur → R2 (optionnel selon provider). */
  getSignedUploadUrl?(key: string, options?: StorageSignedUrlOptions): Promise<string>;
  getMetadata(key: string, context?: StorageOperationContext): Promise<StorageObjectMetadata>;
  move(sourceKey: string, destinationKey: string, context?: StorageOperationContext): Promise<void>;
  list(prefix: string, options?: { maxKeys?: number }): Promise<StorageListResult>;

  createMultipartUpload(
    key: string,
    contentType: string,
    context?: StorageOperationContext,
  ): Promise<MultipartUploadInitResult>;
  uploadPart(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    body: Buffer | Uint8Array;
  }): Promise<MultipartPartResult>;
  completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: MultipartCompletePart[];
  }): Promise<StorageUploadResult>;
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;
}
