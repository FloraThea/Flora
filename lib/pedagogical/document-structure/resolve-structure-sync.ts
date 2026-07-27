import type { ImportedProgrammationRow } from "@/lib/programming/import/types";
import type { ProgressionRow } from "@/lib/progression/types";
import { detectDocumentStructure, parseDocumentStructure } from "./detect-structure";
import type { DocumentStructure } from "./types";

function importRowsFromMetadata(
  metadata?: Record<string, unknown>,
): ImportedProgrammationRow[] | undefined {
  const originalImport = metadata?.original_import;
  if (!originalImport || typeof originalImport !== "object") return undefined;
  const rows = (originalImport as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as ImportedProgrammationRow[]) : undefined;
}

export function resolveProgressionStructure(input: {
  progressionMetadata?: Record<string, unknown>;
  methode?: string;
  matiere?: string;
  rows?: ProgressionRow[];
  importRows?: ImportedProgrammationRow[];
}): DocumentStructure {
  const fromMetadata = parseDocumentStructure(input.progressionMetadata?.structure_document);
  if (fromMetadata) return fromMetadata;

  const importRows = input.importRows ?? importRowsFromMetadata(input.progressionMetadata);

  return detectDocumentStructure({
    methode: input.methode,
    matiere: input.matiere,
    rows: importRows,
  });
}

export function resolveProgressionStructureSync(input: {
  progressionMetadata?: Record<string, unknown>;
  methode?: string;
  matiere?: string;
  rows?: ProgressionRow[];
  importRows?: ImportedProgrammationRow[];
}): DocumentStructure {
  return resolveProgressionStructure(input);
}

export function structureToMetadata(structure: DocumentStructure): Record<string, unknown> {
  return { structure_document: structure };
}
