import { DocumentExtractionError } from "./errors";
import type { DocumentExtractionResult } from "./types";

export async function extractDocxBuffer(buffer: Buffer): Promise<DocumentExtractionResult> {
  const startedAt = Date.now();

  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const text = (result.value ?? "").replace(/\u0000/g, "").replace(/\s+\n/g, "\n").trim();
    const messages = (result.messages ?? [])
      .map((message) => message.message)
      .filter(Boolean);

    console.info("[docx-extractor] Extraction terminée", {
      textLength: text.length,
      warnings: messages.length,
      durationMs: Date.now() - startedAt,
    });

    if (!text) {
      throw new DocumentExtractionError(
        "Aucun texte n'a pu être extrait de ce document Word (.docx).",
        { reason: "empty_document", textLength: 0 },
      );
    }

    return {
      text,
      pageCount: null,
      textLength: text.length,
      preview: text.slice(0, 500),
      extractionMethod: "docx-text",
      usedOcr: false,
      charsPerPage: null,
    };
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error;

    throw new DocumentExtractionError(
      `Impossible d'extraire le texte de ce document Word (.docx) : ${
        error instanceof Error ? error.message : String(error)
      }`,
      { reason: "parser_error", cause: error },
    );
  }
}
