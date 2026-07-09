import type { DocumentExtractionErrorOptions, ExtractionFailureReason } from "./types";

export class DocumentExtractionError extends Error {
  reason: ExtractionFailureReason;
  pageCount: number | null;
  textLength: number;
  preview: string;

  constructor(message: string, options: DocumentExtractionErrorOptions = { reason: "parser_error" }) {
    super(message);
    this.name = "DocumentExtractionError";
    this.reason = options.reason;
    this.pageCount = options.pageCount ?? null;
    this.textLength = options.textLength ?? 0;
    this.preview = options.preview ?? "";

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export function isPasswordProtectedError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "PasswordException" ||
    /password/i.test(error.message) ||
    /mot de passe/i.test(error.message)
  );
}

export function isInvalidPdfError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "InvalidPDFException" ||
    /invalid pdf/i.test(error.message) ||
    /corrupt/i.test(error.message)
  );
}
