import type { ImportPayload } from "../types";
import type { UploadProgress } from "@/lib/documents/import/types";
import { uploadDocumentWithChunks } from "./chunk-upload-client";

type ProgressCallback = (progress: number, statusLabel: string, detailLine?: string) => void;

/**
 * Envoie un document via upload par morceaux (jusqu'à 500 Mo).
 * L'analyse démarre en arrière-plan après l'envoi.
 */
export function uploadDocumentWithProgress(
  file: File,
  onProgress: ProgressCallback,
): Promise<ImportPayload> {
  return uploadDocumentWithChunks(file, (chunkProgress: UploadProgress) => {
    onProgress(
      chunkProgress.percent,
      chunkProgress.label,
      `${Math.round(chunkProgress.uploadedBytes / (1024 * 1024))} Mo / ${Math.round(chunkProgress.totalBytes / (1024 * 1024))} Mo`,
    );
  }).then((result) => ({
    success: true,
    documentId: result.documentId ?? "",
    message:
      result.message ||
      "Votre document est en cours d'analyse… Vous pouvez continuer à utiliser Flora pendant ce temps.",
    warning: result.duplicateDetected ? "Un document similaire existait déjà." : undefined,
    jobId: result.jobId,
  }));
}
