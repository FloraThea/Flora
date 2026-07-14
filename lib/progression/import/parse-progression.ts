import "server-only";

import { recognizeImageBuffer } from "@/lib/documents/extraction/ocr-extractor";
import { parseStructuredText } from "@/lib/programming/import/grid-parser";
import { parseProgrammationFile } from "@/lib/programming/import/parse-programmation";
import type { ProgrammationColumnField } from "@/lib/programming/import/types";
import { isSupportedImageFile } from "@/lib/import/accepted-formats";
import type { ParsedProgressionImport } from "./types";

function isImageFormat(fileName: string, mimeType?: string): boolean {
  return isSupportedImageFile(fileName, mimeType);
}

export async function parseProgressionFile(input: {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
  pastedText?: string;
  columnMapping?: Partial<Record<ProgrammationColumnField, number>>;
  sheetName?: string;
}): Promise<ParsedProgressionImport> {
  if (input.pastedText?.trim()) {
    const parsed = await parseProgrammationFile(input);
    return { ...parsed, format: parsed.format };
  }

  if (isImageFormat(input.fileName, input.mimeType)) {
    const warnings: string[] = [];
    let rows: Awaited<ReturnType<typeof parseProgrammationFile>>["rows"] = [];
    let extractedTextPreview = "";

    try {
      const text = (await recognizeImageBuffer(input.buffer)).trim();
      extractedTextPreview = text.slice(0, 1200);

      if (!text) {
        warnings.push(
          "OCR : aucun texte détecté sur l'image. Utilisez une photo nette ou exportez en Excel.",
        );
      } else {
        rows = parseStructuredText(text);
        if (rows.length === 0) {
          warnings.push(
            "Texte OCR extrait, mais aucun tableau structuré détecté. Vérifiez les colonnes (période, semaine, séance…).",
          );
        }
      }
    } catch {
      warnings.push(
        "Analyse OCR impossible. Réessayez avec une image plus nette ou exportez en Excel (.xlsx).",
      );
      extractedTextPreview = "Extraction OCR limitée.";
    }

    return {
      format: "image",
      fileName: input.fileName,
      discipline: rows[0]?.discipline ?? "",
      niveau: rows[0]?.niveau ?? "",
      rows,
      warnings,
      columns: [],
      previewRows: [],
      rowCount: rows.length,
      needsColumnMapping: false,
      detectedFields: {},
      extractedTextPreview,
    };
  }

  const parsed = await parseProgrammationFile(input);
  return { ...parsed, format: parsed.format };
}
