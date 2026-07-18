import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { getStorageBucketName } from "@/lib/supabase/storage-config";
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

async function resolveBody(body: StorageUploadInput["body"]): Promise<{ bytes: Buffer; size: number }> {
  if (Buffer.isBuffer(body)) return { bytes: body, size: body.length };
  if (body instanceof Uint8Array) return { bytes: Buffer.from(body), size: body.byteLength };
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
  bucket: string,
  context?: StorageOperationContext,
  extra?: Record<string, unknown>,
) {
  return {
    provider: "supabase" as const,
    operation,
    bucket,
    key,
    userId: context?.userId,
    sessionId: context?.sessionId,
    documentId: context?.documentId,
    fileName: context?.fileName,
    extra,
  };
}

/**
 * Fournisseur legacy — conservé pour la lecture des documents déjà stockés dans Supabase Storage.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "supabase" as const;

  private getBucket(): string {
    return getStorageBucketName();
  }

  async upload(input: StorageUploadInput, context?: StorageOperationContext): Promise<StorageUploadResult> {
    const bucket = this.getBucket();
    const contentType = input.contentType ?? "application/octet-stream";
    const { bytes, size } = await resolveBody(input.body);

    try {
      const { error } = await (await floraDb()).storage.from(bucket).upload(input.key, bytes, {
        contentType,
        upsert: false,
      });

      if (error) {
        throw error;
      }

      return {
        provider: this.name,
        bucket,
        key: input.key,
        fileSizeBytes: size,
        contentType,
      };
    } catch (error) {
      failStorage(
        {
          ...buildFailureContext("upload", input.key, bucket, context),
          fileSizeBytes: size,
          contentType,
        },
        error,
      );
    }
  }

  async download(key: string, context?: StorageOperationContext): Promise<StorageDownloadResult> {
    const bucket = this.getBucket();

    try {
      const { data, error } = await (await floraDb()).storage.from(bucket).download(key);
      if (error || !data) {
        throw error ?? new Error("Téléchargement Supabase Storage sans données.");
      }

      const body = Buffer.from(await data.arrayBuffer());

      return {
        body,
        contentType: data.type || "application/octet-stream",
        contentLength: body.length,
      };
    } catch (error) {
      failStorage(buildFailureContext("download", key, bucket, context), error);
    }
  }

  async delete(key: string, context?: StorageOperationContext): Promise<void> {
    const bucket = this.getBucket();

    try {
      const { error } = await (await floraDb()).storage.from(bucket).remove([key]);
      if (error) throw error;
    } catch (error) {
      failStorage(buildFailureContext("delete", key, bucket, context), error);
    }
  }

  async exists(key: string, context?: StorageOperationContext): Promise<boolean> {
    const bucket = this.getBucket();

    try {
      const folder = key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : "";
      const name = key.includes("/") ? key.slice(key.lastIndexOf("/") + 1) : key;
      const { data, error } = await (await floraDb()).storage.from(bucket).list(folder, { search: name, limit: 1 });

      if (error) throw error;
      return (data ?? []).some((item) => item.name === name);
    } catch (error) {
      failStorage(buildFailureContext("exists", key, bucket, context), error);
    }
  }

  async getSignedUrl(key: string, options?: StorageSignedUrlOptions): Promise<string> {
    const bucket = this.getBucket();

    try {
      const { data, error } = await (await floraDb()).storage.from(bucket).createSignedUrl(
        key,
        options?.expiresInSeconds ?? 3600,
      );

      if (error || !data?.signedUrl) {
        throw error ?? new Error("URL signée Supabase indisponible.");
      }

      return data.signedUrl;
    } catch (error) {
      failStorage(buildFailureContext("getSignedUrl", key, bucket), error);
    }
  }

  async getMetadata(key: string, context?: StorageOperationContext): Promise<StorageObjectMetadata> {
    const download = await this.download(key, context);

    return {
      key,
      bucket: this.getBucket(),
      contentType: download.contentType,
      contentLength: download.contentLength,
      etag: download.etag,
    };
  }

  async move(sourceKey: string, destinationKey: string, context?: StorageOperationContext): Promise<void> {
    const bucket = this.getBucket();
    const downloaded = await this.download(sourceKey, context);
    await this.upload(
      {
        key: destinationKey,
        body: downloaded.body,
        contentType: downloaded.contentType,
      },
      context,
    );
    await this.delete(sourceKey, context);
  }

  async list(prefix: string, options?: { maxKeys?: number }): Promise<StorageListResult> {
    const bucket = this.getBucket();

    try {
      const { data, error } = await (await floraDb()).storage.from(bucket).list(prefix, {
        limit: options?.maxKeys ?? 1000,
      });

      if (error) throw error;

      return {
        keys: (data ?? []).map((item) => `${prefix}/${item.name}`.replace(/\/+/g, "/")),
        prefixes: [],
        isTruncated: false,
      };
    } catch (error) {
      failStorage(buildFailureContext("list", prefix, bucket), error);
    }
  }

  async createMultipartUpload(
    key: string,
    contentType: string,
    context?: StorageOperationContext,
  ): Promise<MultipartUploadInitResult> {
    const uploadId = `supabase-legacy-${Date.now()}`;
    return {
      uploadId,
      key,
      bucket: this.getBucket(),
    };
  }

  async uploadPart(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    body: Buffer | Uint8Array;
  }): Promise<MultipartPartResult> {
    const partKey = `${input.key}.part-${String(input.partNumber).padStart(6, "0")}`;
    const result = await this.upload({
      key: partKey,
      body: input.body,
      contentType: "application/octet-stream",
    });

    return {
      partNumber: input.partNumber,
      etag: result.etag ?? String(input.partNumber),
    };
  }

  async completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: MultipartCompletePart[];
  }): Promise<StorageUploadResult> {
    const bucket = this.getBucket();
    const buffers: Buffer[] = [];

    for (const part of input.parts.sort((a, b) => a.partNumber - b.partNumber)) {
      const partKey = `${input.key}.part-${String(part.partNumber).padStart(6, "0")}`;
      const downloaded = await this.download(partKey);
      buffers.push(downloaded.body);
      await this.delete(partKey);
    }

    const merged = Buffer.concat(buffers);

    return this.upload({
      key: input.key,
      body: merged,
      contentType: "application/octet-stream",
    });
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    // Legacy : rien à annuler côté Supabase multipart simulé.
  }
}

export const supabaseStorageProvider = new SupabaseStorageProvider();
