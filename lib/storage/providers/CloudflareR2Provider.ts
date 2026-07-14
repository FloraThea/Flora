import "server-only";

import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Config, getSignedUrlTtlSeconds } from "../config";
import { getR2S3Client } from "../r2-client";
import { failStorage } from "../storage-errors";
import type {
  MultipartCompletePart,
  MultipartPartResult,
  MultipartUploadInitResult,
  StorageDownloadResult,
  StorageListResult,
  StorageObjectMetadata,
  StorageOperationContext,
  StorageProvider,
  StorageSignedUrlOptions,
  StorageUploadInput,
  StorageUploadResult,
} from "../types";

function getClient() {
  return getR2S3Client();
}

function getBucket(): string {
  return getR2Config().bucketName;
}

async function resolveBody(body: StorageUploadInput["body"]): Promise<{
  bytes: Buffer;
  size: number;
}> {
  if (Buffer.isBuffer(body)) {
    return { bytes: body, size: body.length };
  }
  if (body instanceof Uint8Array) {
    return { bytes: Buffer.from(body), size: body.byteLength };
  }
  if (body instanceof ArrayBuffer) {
    const bytes = Buffer.from(body);
    return { bytes, size: bytes.length };
  }
  const arrayBuffer = await body.arrayBuffer();
  const bytes = Buffer.from(arrayBuffer);
  return { bytes, size: bytes.length };
}

function buildFailureContext(
  operation: string,
  key: string,
  context?: StorageOperationContext,
  extra?: Record<string, unknown>,
) {
  return {
    provider: "cloudflare_r2" as const,
    operation,
    bucket: getBucket(),
    key,
    userId: context?.userId,
    sessionId: context?.sessionId,
    documentId: context?.documentId,
    fileName: context?.fileName,
    extra,
  };
}

export class CloudflareR2Provider implements StorageProvider {
  readonly name = "cloudflare_r2" as const;

  async upload(input: StorageUploadInput, context?: StorageOperationContext): Promise<StorageUploadResult> {
    const bucket = getBucket();
    const contentType = input.contentType ?? "application/octet-stream";
    const { bytes, size } = await resolveBody(input.body);

    try {
      const response = await getClient().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: input.key,
          Body: bytes,
          ContentType: contentType,
          Metadata: input.metadata,
        }),
      );

      return {
        provider: this.name,
        bucket,
        key: input.key,
        fileSizeBytes: size,
        contentType,
        etag: response.ETag,
      };
    } catch (error) {
      failStorage(
        {
          ...buildFailureContext("upload", input.key, context),
          fileSizeBytes: size,
          contentType,
        },
        error,
      );
    }
  }

  async download(key: string, context?: StorageOperationContext): Promise<StorageDownloadResult> {
    try {
      const response = await getClient().send(
        new GetObjectCommand({
          Bucket: getBucket(),
          Key: key,
        }),
      );

      if (!response.Body) {
        throw new Error("Objet R2 vide.");
      }

      const body = Buffer.from(await response.Body.transformToByteArray());

      return {
        body,
        contentType: response.ContentType ?? "application/octet-stream",
        contentLength: body.length,
        etag: response.ETag,
      };
    } catch (error) {
      failStorage(buildFailureContext("download", key, context), error);
    }
  }

  async delete(key: string, context?: StorageOperationContext): Promise<void> {
    try {
      await getClient().send(
        new DeleteObjectCommand({
          Bucket: getBucket(),
          Key: key,
        }),
      );
    } catch (error) {
      failStorage(buildFailureContext("delete", key, context), error);
    }
  }

  async exists(key: string, context?: StorageOperationContext): Promise<boolean> {
    try {
      await getClient().send(
        new HeadObjectCommand({
          Bucket: getBucket(),
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      const inspected = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (inspected.name === "NotFound" || inspected.$metadata?.httpStatusCode === 404) {
        return false;
      }
      return failStorage(buildFailureContext("exists", key, context), error);
    }
  }

  async getSignedUrl(key: string, options?: StorageSignedUrlOptions): Promise<string> {
    const expiresIn = options?.expiresInSeconds ?? getSignedUrlTtlSeconds();

    try {
      const command = new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
        ResponseContentType: options?.contentType,
        ResponseContentDisposition: options?.contentDisposition,
      });

      return await getSignedUrl(getClient(), command, { expiresIn });
    } catch (error) {
      failStorage(buildFailureContext("getSignedUrl", key), error);
    }
  }

  async getSignedUploadUrl(key: string, options?: StorageSignedUrlOptions): Promise<string> {
    const expiresIn = options?.expiresInSeconds ?? getSignedUrlTtlSeconds();

    try {
      const command = new PutObjectCommand({
        Bucket: getBucket(),
        Key: key,
        ContentType: options?.contentType ?? "application/octet-stream",
      });

      return await getSignedUrl(getClient(), command, { expiresIn });
    } catch (error) {
      failStorage(buildFailureContext("getSignedUploadUrl", key), error);
    }
  }

  async getMetadata(key: string, context?: StorageOperationContext): Promise<StorageObjectMetadata> {
    try {
      const response = await getClient().send(
        new HeadObjectCommand({
          Bucket: getBucket(),
          Key: key,
        }),
      );

      return {
        key,
        bucket: getBucket(),
        contentType: response.ContentType ?? "application/octet-stream",
        contentLength: Number(response.ContentLength ?? 0),
        etag: response.ETag,
        lastModified: response.LastModified,
      };
    } catch (error) {
      failStorage(buildFailureContext("getMetadata", key, context), error);
    }
  }

  async move(
    sourceKey: string,
    destinationKey: string,
    context?: StorageOperationContext,
  ): Promise<void> {
    const bucket = getBucket();

    try {
      await getClient().send(
        new CopyObjectCommand({
          Bucket: bucket,
          CopySource: `${bucket}/${sourceKey}`,
          Key: destinationKey,
        }),
      );

      await this.delete(sourceKey, context);
    } catch (error) {
      failStorage(
        buildFailureContext("move", destinationKey, context, { sourceKey }),
        error,
      );
    }
  }

  async list(prefix: string, options?: { maxKeys?: number }): Promise<StorageListResult> {
    try {
      const response = await getClient().send(
        new ListObjectsV2Command({
          Bucket: getBucket(),
          Prefix: prefix,
          MaxKeys: options?.maxKeys ?? 1000,
        }),
      );

      return {
        keys: (response.Contents ?? []).map((item) => item.Key!).filter(Boolean),
        prefixes: (response.CommonPrefixes ?? []).map((item) => item.Prefix!).filter(Boolean),
        isTruncated: Boolean(response.IsTruncated),
      };
    } catch (error) {
      failStorage(buildFailureContext("list", prefix), error);
    }
  }

  async createMultipartUpload(
    key: string,
    contentType: string,
    context?: StorageOperationContext,
  ): Promise<MultipartUploadInitResult> {
    try {
      const response = await getClient().send(
        new CreateMultipartUploadCommand({
          Bucket: getBucket(),
          Key: key,
          ContentType: contentType,
        }),
      );

      if (!response.UploadId) {
        throw new Error("CreateMultipartUpload sans UploadId.");
      }

      return {
        uploadId: response.UploadId,
        key,
        bucket: getBucket(),
      };
    } catch (error) {
      failStorage(
        {
          ...buildFailureContext("createMultipartUpload", key, context),
          contentType,
        },
        error,
      );
    }
  }

  async uploadPart(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    body: Buffer | Uint8Array;
  }): Promise<MultipartPartResult> {
    try {
      const response = await getClient().send(
        new UploadPartCommand({
          Bucket: getBucket(),
          Key: input.key,
          UploadId: input.uploadId,
          PartNumber: input.partNumber,
          Body: input.body,
        }),
      );

      if (!response.ETag) {
        throw new Error(`UploadPart ${input.partNumber} sans ETag.`);
      }

      return {
        partNumber: input.partNumber,
        etag: response.ETag,
      };
    } catch (error) {
      failStorage(
        {
          ...buildFailureContext("uploadPart", input.key, undefined, {
            uploadId: input.uploadId,
            partNumber: input.partNumber,
          }),
          fileSizeBytes: input.body.byteLength,
        },
        error,
      );
    }
  }

  async completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: MultipartCompletePart[];
  }): Promise<StorageUploadResult> {
    try {
      const response = await getClient().send(
        new CompleteMultipartUploadCommand({
          Bucket: getBucket(),
          Key: input.key,
          UploadId: input.uploadId,
          MultipartUpload: {
            Parts: input.parts
              .slice()
              .sort((a, b) => a.partNumber - b.partNumber)
              .map((part) => ({
                ETag: part.etag,
                PartNumber: part.partNumber,
              })),
          },
        }),
      );

      const metadata = await this.getMetadata(input.key);

      return {
        provider: this.name,
        bucket: getBucket(),
        key: input.key,
        fileSizeBytes: metadata.contentLength,
        contentType: metadata.contentType,
        etag: response.ETag ?? metadata.etag,
      };
    } catch (error) {
      failStorage(
        buildFailureContext("completeMultipartUpload", input.key, undefined, {
          uploadId: input.uploadId,
          partsCount: input.parts.length,
        }),
        error,
      );
    }
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      await getClient().send(
        new AbortMultipartUploadCommand({
          Bucket: getBucket(),
          Key: key,
          UploadId: uploadId,
        }),
      );
    } catch (error) {
      failStorage(
        buildFailureContext("abortMultipartUpload", key, undefined, { uploadId }),
        error,
      );
    }
  }
}

export const cloudflareR2Provider = new CloudflareR2Provider();
