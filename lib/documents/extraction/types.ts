export type ExtractionMethod =
  | "plain-text"
  | "pdf-text"
  | "pdf-ocr"
  | "ocr-image"
  | "unsupported";

export type ExtractionFailureReason =
  | "unsupported_format"
  | "corrupted_pdf"
  | "password_protected"
  | "scanned_pdf"
  | "empty_document"
  | "parser_error";

export type DocumentExtractionResult = {
  text: string;
  pageCount: number | null;
  textLength: number;
  preview: string;
  extractionMethod: ExtractionMethod;
  usedOcr: boolean;
  charsPerPage: number | null;
};

export type DocumentExtractionErrorOptions = {
  reason: ExtractionFailureReason;
  pageCount?: number | null;
  textLength?: number;
  preview?: string;
  cause?: unknown;
};
