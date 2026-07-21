import type { ExtractionFailureReason, ExtractionMethod } from "./types";

export type PdfDocumentKind = "text" | "scanned" | "protected" | "corrupted" | "empty";

export type PdfPageTextStats = {
  pageNumber: number;
  charCount: number;
};

export type PdfExtractionDiagnostics = {
  fileSizeBytes: number;
  pageCount: number;
  pdfKind: PdfDocumentKind;
  hasTextLayer: boolean;
  nativeTextLength: number;
  finalTextLength: number;
  charsPerPage: number | null;
  pagesWithText: number;
  emptyPages: number;
  durationMs: number;
  extractionMethod: ExtractionMethod;
  usedOcr: boolean;
  ocrPagesProcessed: number;
  perPageChars: PdfPageTextStats[];
  failureReason?: ExtractionFailureReason;
  rootCause?: string;
};

export function logPdfExtractionStage(
  stage: string,
  payload: Record<string, unknown>,
): void {
  console.info(`[pdf-extractor] ${stage}`, payload);
}

export function logPdfExtractionFailure(
  payload: Record<string, unknown>,
  error?: unknown,
): void {
  console.error("[pdf-extractor] Échec extraction", {
    ...payload,
    error,
    errorMessage: error instanceof Error ? error.message : String(error ?? ""),
  });
}
