import { createHash } from "crypto";
import { supabase } from "@/lib/supabase";
import { storageService } from "@/lib/storage";
import { failImportPipeline } from "./import-error-diagnostics";
import { computeUploadProgress } from "./progress";
import {
  computeChunkCount,
  formatBytes,
  IMPORT_CONFIG,
  MAX_UPLOAD_SIZE,
  validateUploadFileSize,
} from "./config";
import type { ChunkUploadResult } from "./types";
import { getFileExtension, isAcceptedResourceFile } from "../types";

export { computeUploadProgress } from "./progress";

export function computeBufferChecksum(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

type SessionMetadata = {
  multipart_upload_id?: string;
  storage_provider?: string;
  user_id?: string;
  document_category?: string;
};

function readSessionMetadata(row: Record<string, unknown>): SessionMetadata {
  return (row.metadata as SessionMetadata) ?? {};
}

export class ChunkUploader {
  async storeChunk(input: {
    sessionId: string;
    chunkIndex: number;
    buffer: Buffer;
    expectedTotalChunks: number;
  }): Promise<ChunkUploadResult> {
    const { data: sessionRow, error: sessionReadError } = await supabase
      .from("document_upload_sessions")
      .select("uploaded_chunk_indexes, file_size, original_filename, total_chunks, content_type, storage_path, metadata")
      .eq("id", input.sessionId)
      .single();

    if (sessionReadError) {
      failImportPipeline(
        {
          step: "database_query",
          table: "document_upload_sessions",
          sessionId: input.sessionId,
        },
        sessionReadError,
      );
    }

    const metadata = readSessionMetadata(sessionRow!);
    const uploadId = metadata.multipart_upload_id;
    const storageKey = sessionRow!.storage_path;

    if (!uploadId || !storageKey) {
      failImportPipeline(
        {
          step: "storage_upload",
          sessionId: input.sessionId,
          fileName: sessionRow?.original_filename,
        },
        new Error("Session sans multipart_upload_id ou storage_path."),
      );
    }

    const partNumber = input.chunkIndex + 1;

    let partResult;
    try {
      partResult = await storageService.uploadPart({
        key: storageKey,
        uploadId: uploadId!,
        partNumber,
        body: input.buffer,
      });
    } catch (error) {
      failImportPipeline(
        {
          step: "storage_upload",
          storagePath: storageKey,
          sessionId: input.sessionId,
          fileName: sessionRow?.original_filename,
          fileSizeBytes: input.buffer.length,
          extra: { partNumber, uploadId },
        },
        error,
      );
    }

    const checksum = computeBufferChecksum(input.buffer);
    const partRef = `${storageKey}#part-${partNumber}`;

    const { error: chunkInsertError } = await supabase.from("document_upload_chunks").upsert(
      {
        session_id: input.sessionId,
        chunk_index: input.chunkIndex,
        storage_path: partRef,
        size: input.buffer.length,
        checksum: partResult!.etag || checksum,
      },
      { onConflict: "session_id,chunk_index" },
    );

    if (chunkInsertError) {
      failImportPipeline(
        {
          step: "database_insert",
          table: "document_upload_chunks",
          sessionId: input.sessionId,
          storagePath: partRef,
          fileSizeBytes: input.buffer.length,
        },
        chunkInsertError,
      );
    }

    const indexes = new Set<number>(sessionRow?.uploaded_chunk_indexes ?? []);
    indexes.add(input.chunkIndex);

    const { error: sessionUpdateError } = await supabase
      .from("document_upload_sessions")
      .update({
        uploaded_chunk_indexes: [...indexes],
        status: "uploading",
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.sessionId);

    if (sessionUpdateError) {
      failImportPipeline(
        {
          step: "database_update",
          table: "document_upload_sessions",
          sessionId: input.sessionId,
        },
        sessionUpdateError,
      );
    }

    const uploadedChunks = indexes.size;
    const chunkSize = IMPORT_CONFIG.chunkSizeBytes;
    const uploadedBytes = Math.min(sessionRow?.file_size ?? 0, uploadedChunks * chunkSize);

    return {
      sessionId: input.sessionId,
      chunkIndex: input.chunkIndex,
      uploadedChunks,
      totalChunks: sessionRow?.total_chunks ?? input.expectedTotalChunks,
      progress: computeUploadProgress({
        uploadedBytes,
        totalBytes: sessionRow?.file_size ?? 0,
        startedAtMs: Date.now() - 1000,
        label: `Import de ${sessionRow?.original_filename ?? "document"}`,
        stage: "upload",
      }),
    };
  }

  async mergeSessionChunks(sessionId: string, finalStoragePath: string): Promise<void> {
    const { data: session, error: sessionError } = await supabase
      .from("document_upload_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      failImportPipeline(
        {
          step: "database_query",
          table: "document_upload_sessions",
          sessionId,
        },
        sessionError ?? new Error("Session introuvable."),
      );
    }

    const metadata = readSessionMetadata(session!);
    const uploadId = metadata.multipart_upload_id;
    const storageKey = session!.storage_path || finalStoragePath;

    if (!uploadId) {
      failImportPipeline(
        { step: "chunk_merge", sessionId, fileName: session!.original_filename },
        new Error("multipart_upload_id manquant pour finaliser l'upload."),
      );
    }

    const { error: mergingUpdateError } = await supabase
      .from("document_upload_sessions")
      .update({ status: "merging", updated_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (mergingUpdateError) {
      failImportPipeline(
        { step: "database_update", table: "document_upload_sessions", sessionId },
        mergingUpdateError,
      );
    }

    const { data: chunkRows, error: chunkQueryError } = await supabase
      .from("document_upload_chunks")
      .select("chunk_index, checksum, size")
      .eq("session_id", sessionId)
      .order("chunk_index", { ascending: true });

    if (chunkQueryError) {
      failImportPipeline(
        { step: "database_query", table: "document_upload_chunks", sessionId },
        chunkQueryError,
      );
    }

    if (!chunkRows?.length) {
      failImportPipeline(
        { step: "chunk_merge", sessionId, fileName: session!.original_filename },
        new Error("Aucun morceau reçu pour cette session."),
      );
    }

    if (chunkRows!.length < session!.total_chunks) {
      failImportPipeline(
        {
          step: "chunk_merge",
          sessionId,
          fileName: session!.original_filename,
          extra: {
            received: chunkRows!.length,
            expected: session!.total_chunks,
          },
        },
        new Error(
          `Import incomplet : ${chunkRows!.length}/${session!.total_chunks} morceaux reçus.`,
        ),
      );
    }

    console.info("[import] Finalisation multipart R2", {
      step: "verification",
      sessionId,
      storageKey,
      fileName: session!.original_filename,
      fileSizeBytes: session!.file_size,
      fileSizeLabel: formatBytes(Number(session!.file_size)),
      contentType: session!.content_type || "application/octet-stream",
      partsCount: chunkRows!.length,
    });

    try {
      await storageService.completeMultipartUpload(
        {
          key: storageKey,
          uploadId: uploadId!,
          parts: chunkRows!.map((row) => ({
            partNumber: row.chunk_index + 1,
            etag: row.checksum,
          })),
        },
        {
          userId: metadata.user_id,
          sessionId,
          fileName: session!.original_filename,
        },
      );

      const objectMeta = await storageService.getMetadata(storageKey, {
        userId: metadata.user_id,
        sessionId,
        fileName: session!.original_filename,
      });

      console.info("[import] Vérification objet R2", {
        sessionId,
        storageKey,
        contentLength: objectMeta.contentLength,
        expectedSize: session!.file_size,
        etag: objectMeta.etag,
      });
    } catch (error) {
      failImportPipeline(
        {
          step: "chunk_merge",
          storagePath: storageKey,
          sessionId,
          fileName: session!.original_filename,
          fileSizeBytes: Number(session!.file_size),
          contentType: session!.content_type || undefined,
          extra: { uploadId, partsCount: chunkRows!.length },
        },
        error,
      );
    }

    const { error: chunkDeleteError } = await supabase
      .from("document_upload_chunks")
      .delete()
      .eq("session_id", sessionId);

    if (chunkDeleteError) {
      failImportPipeline(
        { step: "database_update", table: "document_upload_chunks", sessionId },
        chunkDeleteError,
      );
    }

    const { error: completedUpdateError } = await supabase
      .from("document_upload_sessions")
      .update({
        storage_path: storageKey,
        status: "completed",
        updated_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          verified_at: new Date().toISOString(),
        },
      })
      .eq("id", sessionId);

    if (completedUpdateError) {
      failImportPipeline(
        { step: "database_update", table: "document_upload_sessions", sessionId },
        completedUpdateError,
      );
    }
  }

  validateFileForUpload(filename: string, fileSize: number): { extension: string; maxSize: number } {
    if (!isAcceptedResourceFile(filename)) {
      throw new Error("Format non supporté. Formats acceptés : PDF, DOCX, PPTX, XLSX, TXT.");
    }

    validateUploadFileSize(fileSize, filename);
    const extension = getFileExtension(filename);

    return { extension, maxSize: MAX_UPLOAD_SIZE };
  }

  shouldUseChunkUpload(fileSize: number): boolean {
    return fileSize > IMPORT_CONFIG.directUploadThresholdBytes;
  }

  computeChunkCount(fileSize: number): number {
    return computeChunkCount(fileSize);
  }

  buildFinalStoragePath(_filename: string): string {
    throw new Error("buildFinalStoragePath est obsolète — le chemin R2 est généré à l'init.");
  }
}

export const chunkUploader = new ChunkUploader();
