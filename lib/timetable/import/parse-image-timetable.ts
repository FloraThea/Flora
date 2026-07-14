import "server-only";

import { recognizeImageBuffer } from "@/lib/documents/extraction/ocr-extractor";
import { isSupportedImageFile } from "@/lib/import/accepted-formats";
import { detectStructure } from "./structure-detector";
import { buildParsedImport } from "./session-extractor";
import type { ParsedTimetableImport, StructureOverrides } from "./types";

function textToGrid(text: string): string[][] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [[""]];

  return lines.map((line) => {
    const tabSplit = line.split("\t").filter(Boolean);
    if (tabSplit.length > 1) return tabSplit;
    return line.split(/\s{2,}/).filter(Boolean);
  });
}

export async function parseTimetableImage(
  buffer: Buffer,
  fileName: string,
  subjectOverrides?: Record<string, string>,
  structureOverrides?: StructureOverrides,
): Promise<ParsedTimetableImport> {
  if (!isSupportedImageFile(fileName)) {
    throw new Error(`Format image non supporté pour l'emploi du temps (${fileName}).`);
  }

  const ocrText = (await recognizeImageBuffer(buffer)).trim();
  const grid = textToGrid(ocrText);
  const detection = detectStructure(grid, [], structureOverrides);

  const diagnostics = {
    ...detection.diagnostics,
    anomalies: [
      ...detection.diagnostics.anomalies,
      ocrText
        ? "Image analysée par OCR — vérifiez la structure détectée."
        : "OCR sans texte exploitable — saisissez la structure manuellement.",
    ],
  };

  return buildParsedImport({
    fileName,
    sheetName: "OCR",
    grid,
    merges: [],
    structure: detection.structure,
    needsManualStructure: detection.needsManualStructure || ocrText.length < 20,
    diagnostics,
    subjectOverrides,
    structureOverrides,
  });
}
