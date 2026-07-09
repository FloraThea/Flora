export {
  canAnalyzeExtension,
  DocumentExtractionError,
  extractTextFromBuffer,
  extractTextFromFile,
} from "./extraction/extract-document";

export type {
  DocumentExtractionResult,
  ExtractionFailureReason,
  ExtractionMethod,
} from "./extraction/types";

/** @deprecated Utiliser DocumentExtractionResult */
export type ExtractTextResult = {
  text: string;
  pageCount: number | null;
  extractionMethod: "plain-text" | "pdf-parse" | "pdf-text" | "pdf-ocr" | "unsupported";
  textLength?: number;
  preview?: string;
  usedOcr?: boolean;
  charsPerPage?: number | null;
};
