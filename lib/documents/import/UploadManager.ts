import { supabase } from "@/lib/supabase";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import {
  buildDocumentStorageKey,
  formatMissingR2EnvMessage,
  getMissingR2EnvVars,
  getR2BucketNameFromEnv,
  inferDocumentCategory,
  storageService,
  tryGetR2Config,
} from "@/lib/storage";
import { chunkUploader } from "./ChunkUploader";
import { IMPORT_CONFIG } from "./config";
import { failImportPipeline } from "./import-error-diagnostics";
import type {
  CompleteUploadInput,
  CompleteUploadResult,
  InitUploadInput,
  InitUploadResult,
  UploadSession,
} from "./types";
import { duplicateDetector } from "./DuplicateDetector";
import { importQueue } from "./ImportQueue";
import { notificationManager } from "./NotificationManager";
import { versionManager } from "./VersionManager";

function mapSession(row: Record<string, unknown>): UploadSession {
  return {
    id: String(row.id),
    originalFilename: String(row.original_filename ?? ""),
    fileSize: Number(row.file_size ?? 0),
    chunkSize: Number(row.chunk_size ?? 0),
    totalChunks: Number(row.total_chunks ?? 0),
    uploadedChunkIndexes: (row.uploaded_chunk_indexes as number[]) ?? [],
    storagePath: String(row.storage_path ?? ""),
    documentId: row.document_id ? String(row.document_id) : null,
    status: String(row.status ?? "pending") as UploadSession["status"],
    createdAt: String(row.created_at ?? ""),
  };
}

type SessionMetadata = {
  use_chunk_upload?: boolean;
  storage_provider?: string;
  multipart_upload_id?: string;
  user_id?: string;
  document_category?: string;
  storage_bucket?: string;
};

export class UploadManager {
  async initUpload(input: InitUploadInput): Promise<InitUploadResult> {
    const missingR2 = getMissingR2EnvVars();
    if (storageService.getActiveProviderName() === "cloudflare_r2" && missingR2.length > 0) {
      failImportPipeline(
        {
          step: "storage_upload",
          fileName: input.filename,
          fileSizeBytes: input.fileSize,
          contentType: input.contentType,
          extra: { missingEnv: missingR2 },
        },
        new Error(formatMissingR2EnvMessage(missingR2)),
      );
    }

    const { extension, maxSize } = chunkUploader.validateFileForUpload(
      input.filename,
      input.fileSize,
    );

    const bundle = await loadTeacherProfileBundle();
    const userId = bundle?.profile.id ?? "default";
    const category = inferDocumentCategory(input.filename);
    const storagePath = buildDocumentStorageKey({
      userId,
      filename: input.filename,
    });

    const chunkSize = IMPORT_CONFIG.chunkSizeBytes;
    const totalChunks = chunkUploader.computeChunkCount(input.fileSize);
    const useChunkUpload = chunkUploader.shouldUseChunkUpload(input.fileSize);
    const expiresAt = new Date(Date.now() + IMPORT_CONFIG.sessionTtlHours * 3600 * 1000);
    const contentType = input.contentType || "application/octet-stream";
    const r2Config = tryGetR2Config();
    const r2Bucket = getR2BucketNameFromEnv() ?? r2Config?.bucketName;

    let multipartUploadId: string;
    try {
      const multipart = await storageService.createMultipartUpload(storagePath, contentType, {
        userId,
        fileName: input.filename,
      });
      multipartUploadId = multipart.uploadId;
    } catch (error) {
      failImportPipeline(
        {
          step: "storage_upload",
          storagePath,
          fileName: input.filename,
          fileSizeBytes: input.fileSize,
          contentType,
          extra: { userId, category },
        },
        error,
      );
    }

    const sessionMetadata: SessionMetadata = {
      use_chunk_upload: useChunkUpload,
      storage_provider: storageService.getActiveProviderName(),
      multipart_upload_id: multipartUploadId!,
      user_id: userId,
      document_category: category,
      storage_bucket: r2Bucket,
    };

    const { data, error } = await supabase
      .from("document_upload_sessions")
      .insert({
        original_filename: input.filename,
        content_type: contentType,
        file_extension: extension.replace(".", ""),
        file_size: input.fileSize,
        chunk_size: chunkSize,
        total_chunks: totalChunks,
        storage_path: storagePath,
        status: "pending",
        file_checksum: input.checksum ?? "",
        expires_at: expiresAt.toISOString(),
        metadata: sessionMetadata,
      })
      .select("*")
      .single();

    if (error || !data) {
      try {
        await storageService.abortMultipartUpload(storagePath, multipartUploadId!);
      } catch {
        // Abort best-effort si l'insertion DB échoue.
      }

      failImportPipeline(
        {
          step: "database_insert",
          table: "document_upload_sessions",
          fileName: input.filename,
          fileSizeBytes: input.fileSize,
          contentType,
          storagePath,
        },
        error ?? new Error("Insertion session impossible."),
      );
    }

    console.info("[import/init] Session R2 prête", {
      sessionId: data.id,
      storagePath,
      bucket: r2Bucket,
      userId,
      category,
      fileSizeBytes: input.fileSize,
      totalChunks,
    });

    return {
      sessionId: String(data.id),
      chunkSize,
      totalChunks,
      maxFileSize: maxSize,
      useChunkUpload,
      storagePath,
      storageProvider: sessionMetadata.storage_provider,
    };
  }

  async completeUpload(input: CompleteUploadInput): Promise<CompleteUploadResult> {
    const { data: sessionRow, error } = await supabase
      .from("document_upload_sessions")
      .select("*")
      .eq("id", input.sessionId)
      .single();

    if (error || !sessionRow) {
      failImportPipeline(
        { step: "database_query", table: "document_upload_sessions", sessionId: input.sessionId },
        error ?? new Error("Session introuvable."),
      );
    }

    const session = mapSession(sessionRow);
    const sessionMetadata = (sessionRow.metadata as SessionMetadata) ?? {};
    const uploaded = new Set(session.uploadedChunkIndexes);

    if (uploaded.size < session.totalChunks) {
      throw new Error(
        `Import incomplet : ${uploaded.size}/${session.totalChunks} morceaux reçus.`,
      );
    }

    const duplicates = await duplicateDetector.findDuplicates({
      filename: session.originalFilename,
      fileSize: session.fileSize,
      checksum: input.checksum,
    });

    if (duplicates.length > 0 && !input.duplicateResolution) {
      return {
        sessionId: session.id,
        documentId: duplicates[0].id,
        jobId: "",
        duplicateDetected: true,
        message: "Un document similaire existe déjà. Choisissez une action.",
      };
    }

    await chunkUploader.mergeSessionChunks(session.id, session.storagePath);

    let documentId: string;

    const documentMetadata = {
      import_session_id: session.id,
      imported_at: new Date().toISOString(),
      storage_provider: sessionMetadata.storage_provider ?? storageService.getActiveProviderName(),
      storage_bucket: sessionMetadata.storage_bucket ?? getR2BucketNameFromEnv() ?? tryGetR2Config()?.bucketName,
      document_category: sessionMetadata.document_category,
      user_id: sessionMetadata.user_id,
    };

    if (duplicates.length > 0 && input.duplicateResolution === "replace") {
      documentId = duplicates[0].id;
      await versionManager.createVersion(documentId, {
        storagePath: session.storagePath,
        fileSize: session.fileSize,
        originalFilename: session.originalFilename,
      });
      await supabase
        .from("documents")
        .update({
          storage_path: session.storagePath,
          file_size: session.fileSize,
          original_filename: session.originalFilename,
          status: "uploaded",
          metadata: documentMetadata,
        })
        .eq("id", documentId);
    } else {
      const { data: created, error: createError } = await supabase
        .from("documents")
        .insert({
          title: session.originalFilename.replace(/\.[^.]+$/, ""),
          original_filename: session.originalFilename,
          document_type: "",
          file_extension: sessionRow.file_extension,
          file_size: session.fileSize,
          storage_path: session.storagePath,
          status: "uploaded",
          metadata: documentMetadata,
        })
        .select("*")
        .single();

      if (createError || !created) {
        failImportPipeline(
          {
            step: "database_insert",
            table: "documents",
            sessionId: session.id,
            fileName: session.originalFilename,
            fileSizeBytes: session.fileSize,
            storagePath: session.storagePath,
          },
          createError ?? new Error("Insertion document impossible."),
        );
      }

      documentId = String(created.id);
      await versionManager.createVersion(documentId, {
        storagePath: session.storagePath,
        fileSize: session.fileSize,
        originalFilename: session.originalFilename,
      });
    }

    await supabase
      .from("document_upload_sessions")
      .update({ document_id: documentId })
      .eq("id", session.id);

    const job = await importQueue.enqueue(documentId, session.id);

    await notificationManager.notify({
      documentId,
      jobId: job.id,
      type: "upload_complete",
      message: "Import terminé. Analyse en cours…",
    });

    void importQueue.processNext();

    return {
      sessionId: session.id,
      documentId,
      jobId: job.id,
      duplicateDetected: false,
      message:
        "Votre document est en cours d'analyse… Vous pouvez continuer à utiliser Flora pendant ce temps.",
    };
  }

  async getSession(sessionId: string): Promise<UploadSession | null> {
    const { data } = await supabase
      .from("document_upload_sessions")
      .select("*")
      .eq("id", sessionId)
      .maybeSingle();

    return data ? mapSession(data) : null;
  }

  async cancelSession(sessionId: string): Promise<void> {
    const { data: session } = await supabase
      .from("document_upload_sessions")
      .select("storage_path, metadata")
      .eq("id", sessionId)
      .maybeSingle();

    const metadata = (session?.metadata as SessionMetadata) ?? {};

    if (session?.storage_path && metadata.multipart_upload_id) {
      try {
        await storageService.abortMultipartUpload(session.storage_path, metadata.multipart_upload_id);
      } catch (error) {
        console.warn("[import] Abort multipart R2 échoué", { sessionId, error });
      }
    }

    await supabase.from("document_upload_chunks").delete().eq("session_id", sessionId);
    await supabase.from("document_upload_sessions").update({ status: "cancelled" }).eq("id", sessionId);
  }
}

export const uploadManager = new UploadManager();
