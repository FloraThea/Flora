/**
 * Client-side helpers for programming import batch workflow.
 * Keeps File objects in a Map so they survive React re-renders.
 */

import {
  PROGRAMMING_IMPORT_API_BODY_LIMIT_BYTES,
  PROGRAMMING_IMPORT_DIRECT_UPLOAD_THRESHOLD_BYTES,
} from "./batch-limits";
import type { ProgrammingImportUploadedFileDescriptor } from "./batch-types";

export type ImportWorkflowStep =
  | "idle"
  | "files_selected"
  | "batch_create"
  | "uploading"
  | "analyzing"
  | "merging"
  | "review"
  | "saving"
  | "success"
  | "error";

export type ImportApiErrorBody = {
  error?: string;
  details?: string;
  step?: string;
};

export function parseImportApiError(data: ImportApiErrorBody, fallback: string): string {
  return data.error?.trim() || data.details?.trim() || fallback;
}

export function mapImportFailureMessage(step: string, rawMessage: string): string {
  const message = rawMessage.trim();
  if (message) return message;

  if (step.startsWith("upload")) {
    return "Le téléversement des fichiers a échoué.";
  }
  if (step === "batch_create") {
    return "Impossible de créer le lot d'import.";
  }
  if (step === "analyze") {
    return "L'analyse des pages a échoué.";
  }
  if (step === "merge") {
    return "Les données ont été analysées, mais la fusion a échoué.";
  }
  if (step === "save") {
    return "La programmation n'a pas pu être enregistrée.";
  }

  return "Une erreur inattendue est survenue pendant l'import.";
}

export function shouldUseDirectUpload(fileSize: number): boolean {
  return fileSize >= PROGRAMMING_IMPORT_DIRECT_UPLOAD_THRESHOLD_BYTES;
}

export function canUseApiUpload(fileSize: number): boolean {
  return fileSize <= PROGRAMMING_IMPORT_API_BODY_LIMIT_BYTES;
}

export type PrepareUploadResponse = {
  fileId: string;
  storagePath: string;
  mode: "direct" | "api";
  uploadUrl?: string;
};

export type ConfirmUploadResponse = {
  entries: Array<{ fileId: string; pageOrder: number; pdfPageNumber?: number; storagePath: string }>;
};

export async function prepareBatchFileUpload(input: {
  batchId: string;
  pageOrder: number;
  clientFileId: string;
  file: File;
}): Promise<PrepareUploadResponse> {
  const response = await fetch("/api/programmation/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "batch_upload_prepare",
      batchId: input.batchId,
      pageOrder: input.pageOrder,
      clientFileId: input.clientFileId,
      fileName: input.file.name,
      mimeType: input.file.type,
      fileSize: input.file.size,
    }),
  });

  const data = (await response.json()) as PrepareUploadResponse & ImportApiErrorBody;
  if (!response.ok) {
    throw new Error(parseImportApiError(data, "Le téléversement des fichiers a échoué."));
  }

  return data;
}

export async function uploadFileDirect(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error("Le téléversement vers le stockage a échoué.");
  }
}

export async function uploadFileViaApi(input: {
  batchId: string;
  pageOrder: number;
  clientFileId: string;
  file: File;
}): Promise<ConfirmUploadResponse> {
  const formData = new FormData();
  formData.append("action", "batch_upload");
  formData.append("batchId", input.batchId);
  formData.append("pageOrder", String(input.pageOrder));
  formData.append("clientFileId", input.clientFileId);
  formData.append("file", input.file);

  const response = await fetch("/api/programmation/import", { method: "POST", body: formData });
  const data = (await response.json()) as ConfirmUploadResponse & ImportApiErrorBody;

  if (!response.ok || !data.entries?.length) {
    throw new Error(parseImportApiError(data, "Le téléversement des fichiers a échoué."));
  }

  return data;
}

export async function confirmBatchFileUpload(input: {
  batchId: string;
  fileId: string;
  storagePath: string;
  pageOrder: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<ConfirmUploadResponse> {
  const response = await fetch("/api/programmation/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "batch_upload_confirm",
      ...input,
    }),
  });

  const data = (await response.json()) as ConfirmUploadResponse & ImportApiErrorBody;
  if (!response.ok || !data.entries?.length) {
    throw new Error(parseImportApiError(data, "Le téléversement des fichiers a échoué."));
  }

  return data;
}

export async function uploadBatchFile(input: {
  batchId: string;
  pageOrder: number;
  clientFileId: string;
  file: File;
}): Promise<ProgrammingImportUploadedFileDescriptor> {
  const useDirect = shouldUseDirectUpload(input.file.size);

  if (useDirect) {
    const prepared = await prepareBatchFileUpload(input);
    if (prepared.mode === "direct" && prepared.uploadUrl) {
      await uploadFileDirect(prepared.uploadUrl, input.file);
      const confirmed = await confirmBatchFileUpload({
        batchId: input.batchId,
        fileId: prepared.fileId,
        storagePath: prepared.storagePath,
        pageOrder: input.pageOrder,
        fileName: input.file.name,
        mimeType: input.file.type,
        fileSize: input.file.size,
      });
      const entry = confirmed.entries[0]!;
      return {
        fileId: entry.fileId,
        filename: input.file.name,
        mimeType: input.file.type,
        pageOrder: entry.pageOrder,
        storagePath: entry.storagePath,
        pdfPageNumber: entry.pdfPageNumber,
      };
    }
  }

  if (!canUseApiUpload(input.file.size)) {
    throw new Error(
      "Ce fichier est trop volumineux pour l'upload via l'API. Réessayez ou réduisez la taille de l'image.",
    );
  }

  const uploaded = await uploadFileViaApi(input);
  const entry = uploaded.entries[0]!;
  return {
    fileId: entry.fileId,
    filename: input.file.name,
    mimeType: input.file.type,
    pageOrder: entry.pageOrder,
    storagePath: entry.storagePath,
    pdfPageNumber: entry.pdfPageNumber,
  };
}

/** Conserve les objets File hors du state React. */
export class ImportFileRegistry {
  private readonly files = new Map<string, File>();

  set(clientId: string, file: File): void {
    this.files.set(clientId, file);
  }

  get(clientId: string): File | undefined {
    return this.files.get(clientId);
  }

  delete(clientId: string): void {
    this.files.delete(clientId);
  }

  has(clientId: string): boolean {
    return this.files.has(clientId);
  }

  count(): number {
    return this.files.size;
  }
}
