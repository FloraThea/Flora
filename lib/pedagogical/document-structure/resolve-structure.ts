import { floraDb } from "@/lib/supabase/get-db";
import { detectDocumentStructure, parseDocumentStructure } from "./detect-structure";
import { resolveProgressionStructure } from "./resolve-structure-sync";
import type { DocumentStructure } from "./types";
import type { ProgressionRow } from "@/lib/progression/types";

export async function loadDocumentStructureById(
  documentId: string,
): Promise<DocumentStructure | null> {
  const { data } = await (await floraDb())
    .from("documents")
    .select("metadata, methode, document_type, original_filename")
    .eq("id", documentId)
    .maybeSingle();

  if (!data) return null;

  const metadata = (data.metadata as Record<string, unknown> | null) ?? {};
  const parsed = parseDocumentStructure(metadata.structure_document);
  if (parsed) return parsed;

  return detectDocumentStructure({
    methode: String(data.methode ?? metadata.methode ?? ""),
    matiere: String(data.document_type ?? ""),
    filename: String(data.original_filename ?? ""),
  });
}

export async function resolveProgressionStructureWithDocument(input: {
  progressionMetadata?: Record<string, unknown>;
  methode?: string;
  matiere?: string;
  rows?: ProgressionRow[];
}): Promise<DocumentStructure> {
  const direct = resolveProgressionStructure(input);
  if (parseDocumentStructure(input.progressionMetadata?.structure_document)) {
    return direct;
  }

  const sourceDocumentId = input.rows
    ?.map((row) => String(row.metadata?.sourceDocumentId ?? ""))
    .find(Boolean);

  if (sourceDocumentId) {
    const fromDoc = await loadDocumentStructureById(sourceDocumentId);
    if (fromDoc) return fromDoc;
  }

  return direct;
}

export {
  resolveProgressionStructure,
  resolveProgressionStructureSync,
  structureToMetadata,
} from "./resolve-structure-sync";
