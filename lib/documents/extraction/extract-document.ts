import "server-only";

import {
  COMING_SOON_EXTENSIONS,
  FULLY_SUPPORTED_EXTENSIONS,
  getFileExtension,
  isAcceptedResourceFile,
} from "@/lib/documents/types";
import { recognizeImageBuffer } from "@/lib/documents/extraction/ocr-extractor";
import { isSupportedImageFile } from "@/lib/import/accepted-formats";
import { DocumentExtractionError } from "./errors";
import { extractPdfBuffer } from "./pdf-extractor";
import type { DocumentExtractionResult, ExtractionMethod } from "./types";

export type { DocumentExtractionResult, ExtractionMethod };
export { DocumentExtractionError } from "./errors";

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<DocumentExtractionResult> {
  const extension = getFileExtension(fileName);

  if (extension === ".txt") {
    const text = buffer.toString("utf8").trim();
    return {
      text,
      pageCount: null,
      textLength: text.length,
      preview: text.slice(0, 500),
      extractionMethod: "plain-text",
      usedOcr: false,
      charsPerPage: null,
    };
  }

  if (extension === ".pdf") {
    return extractPdfBuffer(buffer);
  }

  if (isSupportedImageFile(fileName)) {
    const text = (await recognizeImageBuffer(buffer)).trim();
    return {
      text,
      pageCount: 1,
      textLength: text.length,
      preview: text.slice(0, 500),
      extractionMethod: "ocr-image",
      usedOcr: true,
      charsPerPage: text.length || null,
    };
  }

  throw new DocumentExtractionError(
    `Format non supporté pour l'extraction automatique (${extension || "inconnu"}).`,
    { reason: "unsupported_format" },
  );
}

export async function extractTextFromFile(
  file: File,
): Promise<DocumentExtractionResult> {
  if (!isAcceptedResourceFile(file.name, file.type)) {
    throw new DocumentExtractionError(
      "Format non supporté. Formats acceptés : JPG, JPEG, PNG, PDF, DOCX, PPTX, XLSX, TXT.",
      { reason: "unsupported_format" },
    );
  }

  const extension = getFileExtension(file.name);

  if (extension === ".txt") {
    const text = (await file.text()).trim();
    return {
      text,
      pageCount: null,
      textLength: text.length,
      preview: text.slice(0, 500),
      extractionMethod: "plain-text",
      usedOcr: false,
      charsPerPage: null,
    };
  }

  if (extension === ".pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    return extractPdfBuffer(buffer);
  }

  if (COMING_SOON_EXTENSIONS.includes(extension as never)) {
    throw new DocumentExtractionError(
      "Format bientôt pris en charge. Seuls TXT et PDF sont analysés automatiquement pour l'instant.",
      { reason: "unsupported_format" },
    );
  }

  if (!FULLY_SUPPORTED_EXTENSIONS.includes(extension as never)) {
    throw new DocumentExtractionError("Format non supporté.", {
      reason: "unsupported_format",
    });
  }

  return {
    text: "",
    pageCount: null,
    textLength: 0,
    preview: "",
    extractionMethod: "unsupported",
    usedOcr: false,
    charsPerPage: null,
  };
}

export function canAnalyzeExtension(extension: string): boolean {
  return extension === ".txt" || extension === ".pdf";
}
