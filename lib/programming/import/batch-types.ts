import type { ParsedProgrammationImport } from "./types";

export type ImportBatchStatus =
  | "draft"
  | "uploading"
  | "analyzing"
  | "ready"
  | "error";

export type ImportedFileStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "analyzing"
  | "analyzed"
  | "error"
  | "skipped";

export type ImportBatchMergeMode = "single_document" | "multiple_programmations";

export type ImportedFile = {
  id: string;
  batchId: string;
  filename: string;
  mimeType: string;
  pageOrder: number;
  storagePath?: string;
  previewUrl?: string;
  analysisStatus: ImportedFileStatus;
  analysisError?: string;
  fileSizeBytes?: number;
  pdfPageNumber?: number;
  sourceFileId?: string;
  parsedSnapshot?: ParsedProgrammationImport;
};

export type ImportBatch = {
  id: string;
  userId: string;
  schoolYear?: string;
  documentType: "programming";
  files: ImportedFile[];
  status: ImportBatchStatus;
  mergeMode: ImportBatchMergeMode;
  parsed?: ParsedProgrammationImport;
  error?: string;
};

export type ProgrammationImportBatchMeta = {
  batchId: string;
  mergeMode: ImportBatchMergeMode;
  sourceFiles: Array<{
    fileId: string;
    fileName: string;
    pageOrder: number;
    storagePath?: string;
    pdfPageNumber?: number;
  }>;
};
