/**
 * Moteur d'import unifié Flora — contrat partagé par tous les modules.
 * Implémentations : programmation, progression, emploi du temps, documents.
 */

export const UNIFIED_IMPORT_MODULES = [
  "programmation",
  "progression",
  "timetable",
  "document",
] as const;

export type UnifiedImportModule = (typeof UNIFIED_IMPORT_MODULES)[number];

export type UnifiedImportFormat =
  | "png"
  | "jpg"
  | "jpeg"
  | "pdf"
  | "docx"
  | "xlsx"
  | "csv"
  | "text";

export type UnifiedImportStatus =
  | "idle"
  | "uploading"
  | "uploaded"
  | "analyzing"
  | "analyzed"
  | "failed"
  | "saved";

export type UnifiedImportPage = {
  fileId: string;
  clientId: string;
  filename: string;
  mimeType: string;
  pageOrder: number;
  storagePath: string;
  pdfPageNumber?: number;
};

export type UnifiedImportBatchConfig = {
  module: "programmation" | "progression" | "timetable" | "document";
  batchId: string;
  profileId: string;
  schoolYear: string;
  mergeMode: "single_document" | "multiple_programmations";
};

export type UnifiedImportAnalyzeResult<TParsed> = {
  parsed: TParsed;
  pages: UnifiedImportPage[];
  warnings: string[];
};

export type UnifiedImportEngine<TParsed, TSession, TSaved> = {
  module: UnifiedImportBatchConfig["module"];
  createBatch: (config: Omit<UnifiedImportBatchConfig, "batchId"> & { batchId?: string }) => Promise<string>;
  uploadPage: (input: { batchId: string; page: UnifiedImportPage; file: File }) => Promise<UnifiedImportPage>;
  analyze: (input: UnifiedImportBatchConfig & { pages: UnifiedImportPage[] }) => Promise<UnifiedImportAnalyzeResult<TParsed>>;
  buildSession: (input: { parsed: TParsed; config: UnifiedImportBatchConfig }) => Promise<TSession>;
  save: (input: { session: TSession; config: UnifiedImportBatchConfig }) => Promise<TSaved>;
};

export const UNIFIED_IMPORT_ACCEPT =
  ".png,.jpg,.jpeg,.pdf,.docx,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
