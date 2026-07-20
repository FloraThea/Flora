import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { onlyActive } from "@/lib/trash/active-query";
import { logPedagogicalChange } from "@/lib/pedagogical/change-history";
import {
  isSourceDocumentEmpty,
  updateSourceCell,
  type SourceDocument,
} from "./source-document";

export type SourceDocumentEntityType = "programmation" | "progression";

const TABLE_BY_ENTITY: Record<SourceDocumentEntityType, string> = {
  programmation: "programmations",
  progression: "progressions",
};

export function parseSourceDocument(raw: unknown): SourceDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const doc = raw as SourceDocument;
  if (doc.version !== 1 || !Array.isArray(doc.sheets)) return null;
  return doc;
}

export function resolveStoredSourceDocument(row: {
  source_document?: unknown;
  original_import?: unknown;
  metadata?: unknown;
}): SourceDocument | null {
  const fromColumn = parseSourceDocument(row.source_document);
  if (fromColumn && !isSourceDocumentEmpty(fromColumn)) return fromColumn;

  const originalImport =
    row.original_import && typeof row.original_import === "object"
      ? (row.original_import as Record<string, unknown>)
      : null;

  const fromOriginal = parseSourceDocument(originalImport?.sourceDocument);
  if (fromOriginal && !isSourceDocumentEmpty(fromOriginal)) return fromOriginal;

  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null;
  const fromMetadata = parseSourceDocument(metadata?.source_document);
  if (fromMetadata && !isSourceDocumentEmpty(fromMetadata)) return fromMetadata;

  return fromColumn;
}

export async function updateSourceDocumentCell(input: {
  entityType: SourceDocumentEntityType;
  entityId: string;
  sheetIndex: number;
  row: number;
  col: number;
  displayValue: string;
}): Promise<SourceDocument> {
  const scope = await requireTeacherScope();
  const table = TABLE_BY_ENTITY[input.entityType];

  const { data: existing, error: loadError } = await onlyActive(
    (await floraDb()).from(table).select("*").eq("id", input.entityId),
  ).single();

  if (loadError || !existing) {
    throw new Error("Document introuvable.");
  }

  if (existing.teacher_profile_id !== scope.profileId) {
    throw new Error("Accès refusé.");
  }

  const current = resolveStoredSourceDocument(existing);
  if (!current || isSourceDocumentEmpty(current)) {
    throw new Error("Aucune copie fidèle disponible pour ce document.");
  }

  const sheet = current.sheets[input.sheetIndex];
  if (!sheet) {
    throw new Error("Feuille introuvable.");
  }

  const previousValue = sheet.rows[input.row]?.[input.col]?.displayValue ?? "";
  const updated = updateSourceCell(
    current,
    input.sheetIndex,
    input.row,
    input.col,
    input.displayValue,
  );

  const { error: saveError } = await (await floraDb())
    .from(table)
    .update({ source_document: updated })
    .eq("id", input.entityId);

  if (saveError) {
    throw saveError;
  }

  void logPedagogicalChange({
    module: input.entityType,
    entityType: input.entityType,
    entityId: input.entityId,
    fieldName: `source_cell:${input.sheetIndex}:${input.row}:${input.col}`,
    oldValue: previousValue,
    newValue: input.displayValue,
    eventType: input.entityType === "programmation" ? "programmation.modifiee" : "progression.modifiee",
  });

  return updated;
}
