import "server-only";

import { getStorageProviderName, tryGetR2Config, type StorageProviderName } from "./config";
import { cloudflareR2Provider } from "./providers/CloudflareR2Provider";
import { supabaseStorageProvider } from "./providers/SupabaseStorageProvider";
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
} from "./types";

function resolveProvider(name?: StorageProviderName): StorageProvider {
  const providerName = name ?? getStorageProviderName();

  if (providerName === "supabase") {
    return supabaseStorageProvider;
  }

  if (!tryGetR2Config()) {
    throw new Error(
      "Cloudflare R2 est le fournisseur par défaut mais la configuration est incomplète. " +
        "Consultez lib/storage/README.md ou définissez FLORA_STORAGE_PROVIDER=supabase pour le mode legacy.",
    );
  }

  return cloudflareR2Provider;
}

function resolveProviderForKey(
  key: string,
  explicit?: StorageProviderName,
): StorageProvider {
  if (explicit) return resolveProvider(explicit);

  if (key.startsWith("documents/")) {
    return resolveProvider("cloudflare_r2");
  }

  return resolveProvider(getStorageProviderName());
}

export class StorageService {
  upload(
    input: StorageUploadInput,
    context?: StorageOperationContext,
    providerName?: StorageProviderName,
  ): Promise<StorageUploadResult> {
    return resolveProvider(providerName).upload(input, context);
  }

  download(
    key: string,
    context?: StorageOperationContext,
    providerName?: StorageProviderName,
  ): Promise<StorageDownloadResult> {
    return resolveProviderForKey(key, providerName).download(key, context);
  }

  delete(
    key: string,
    context?: StorageOperationContext,
    providerName?: StorageProviderName,
  ): Promise<void> {
    return resolveProviderForKey(key, providerName).delete(key, context);
  }

  exists(
    key: string,
    context?: StorageOperationContext,
    providerName?: StorageProviderName,
  ): Promise<boolean> {
    return resolveProviderForKey(key, providerName).exists(key, context);
  }

  getSignedUrl(
    key: string,
    options?: StorageSignedUrlOptions,
    providerName?: StorageProviderName,
  ): Promise<string> {
    return resolveProviderForKey(key, providerName).getSignedUrl(key, options);
  }

  getSignedUploadUrl(
    key: string,
    options?: StorageSignedUrlOptions,
    providerName?: StorageProviderName,
  ): Promise<string> {
    const provider = resolveProviderForKey(key, providerName);
    if (!provider.getSignedUploadUrl) {
      throw new Error("Upload direct non disponible pour ce fournisseur de stockage.");
    }
    return provider.getSignedUploadUrl(key, options);
  }

  getMetadata(
    key: string,
    context?: StorageOperationContext,
    providerName?: StorageProviderName,
  ): Promise<StorageObjectMetadata> {
    return resolveProviderForKey(key, providerName).getMetadata(key, context);
  }

  move(
    sourceKey: string,
    destinationKey: string,
    context?: StorageOperationContext,
    providerName?: StorageProviderName,
  ): Promise<void> {
    return resolveProviderForKey(sourceKey, providerName).move(sourceKey, destinationKey, context);
  }

  list(
    prefix: string,
    options?: { maxKeys?: number },
    providerName?: StorageProviderName,
  ): Promise<StorageListResult> {
    return resolveProvider(providerName).list(prefix, options);
  }

  createMultipartUpload(
    key: string,
    contentType: string,
    context?: StorageOperationContext,
    providerName?: StorageProviderName,
  ): Promise<MultipartUploadInitResult> {
    return resolveProvider(providerName).createMultipartUpload(key, contentType, context);
  }

  uploadPart(
    input: {
      key: string;
      uploadId: string;
      partNumber: number;
      body: Buffer | Uint8Array;
    },
    providerName?: StorageProviderName,
  ): Promise<MultipartPartResult> {
    return resolveProvider(providerName).uploadPart(input);
  }

  completeMultipartUpload(
    input: {
      key: string;
      uploadId: string;
      parts: MultipartCompletePart[];
    },
    context?: StorageOperationContext,
    providerName?: StorageProviderName,
  ): Promise<StorageUploadResult> {
    return resolveProvider(providerName).completeMultipartUpload(input);
  }

  abortMultipartUpload(
    key: string,
    uploadId: string,
    providerName?: StorageProviderName,
  ): Promise<void> {
    return resolveProvider(providerName).abortMultipartUpload(key, uploadId);
  }

  getActiveProviderName(): StorageProviderName {
    return getStorageProviderName();
  }
}

export const storageService = new StorageService();

export function readDocumentStorageProvider(
  metadata: Record<string, unknown> | null | undefined,
): StorageProviderName | undefined {
  const raw = metadata?.storage_provider;
  if (raw === "cloudflare_r2" || raw === "supabase") return raw;
  return undefined;
}
