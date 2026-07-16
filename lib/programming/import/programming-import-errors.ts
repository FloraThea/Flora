export type ProgrammingImportErrorCode =
  | "storage_download_failed"
  | "file_not_accessible"
  | "unsupported_format"
  | "empty_analysis_response"
  | "invalid_analysis_response"
  | "analysis_timeout"
  | "missing_api_key"
  | "page_analysis_failed"
  | "no_pages_analyzed";

export class ProgrammingImportError extends Error {
  readonly code: ProgrammingImportErrorCode;
  readonly fileId?: string;
  readonly pageOrder?: number;
  readonly details?: string;

  constructor(
    code: ProgrammingImportErrorCode,
    message: string,
    options?: { fileId?: string; pageOrder?: number; details?: string; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "ProgrammingImportError";
    this.code = code;
    this.fileId = options?.fileId;
    this.pageOrder = options?.pageOrder;
    this.details = options?.details;
  }
}

export function mapProgrammingImportErrorMessage(error: unknown): string {
  if (error instanceof ProgrammingImportError) {
    return error.message;
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("introuvable") || message.includes("not found") || message.includes("nosuchkey")) {
      return "Le fichier téléversé n'est plus accessible. Réessayez l'analyse ou remplacez la page.";
    }
    if (message.includes("timeout") || message.includes("timed out")) {
      return "L'analyse a dépassé le délai autorisé. Réessayez avec moins de pages ou des images plus légères.";
    }
    if (message.includes("ocr") || message.includes("image")) {
      return "Le format de l'image n'a pas pu être reconnu par le service d'analyse.";
    }
    return error.message;
  }
  return "L'analyse des pages a échoué.";
}
