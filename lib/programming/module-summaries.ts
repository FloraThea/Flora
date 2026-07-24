import type { ImportedProgrammationRow } from "./import/types";
import type { ProgrammationModuleSummary, ProgrammingTable } from "./types";

function parseSessionCount(seance: string): number {
  const match = seance.match(/(\d+)\s*s[ée]ances?/i);
  if (match) return Math.max(1, Number.parseInt(match[1] ?? "1", 10));
  if (/^\d+$/.test(seance.trim())) return Math.max(1, Number.parseInt(seance, 10));
  if (/s[ée]ance/i.test(seance)) return 1;
  return 1;
}

function formatModuleLabel(sequence: string, objectif?: string): string {
  const trimmed = sequence.trim();
  if (/^m(\d+)$/i.test(trimmed)) {
    const num = trimmed.replace(/^m/i, "");
    return `Module ${num}`;
  }
  if (/^module\s+\d+/i.test(trimmed)) return trimmed;
  if (trimmed) return trimmed;
  if (objectif) return objectif.slice(0, 60);
  return "Module";
}

function extractObjectifPrincipal(objectif: string): string {
  const firstLine = objectif.split(/\n/)[0]?.trim() ?? "";
  return firstLine.length > 120 ? `${firstLine.slice(0, 117)}…` : firstLine;
}

/**
 * Construit la vue synthétique annuelle (modules / séquences) à partir des lignes importées.
 */
export function buildModuleSummariesFromRows(
  rows: ImportedProgrammationRow[],
  options?: {
    sourceDocumentId?: string;
    sourceDocumentTitle?: string;
  },
): ProgrammationModuleSummary[] {
  return rows.map((row, index) => {
    const label = formatModuleLabel(row.sequence, row.objectif);
    const sessionCount = parseSessionCount(row.seance);
    const seanceLabels = Array.from({ length: sessionCount }, (_, sessionIndex) =>
      sessionCount === 1 && row.seance && !/\d+\s*s[ée]ances?/i.test(row.seance)
        ? row.seance
        : `Séance ${sessionIndex + 1}`,
    );

    const sourcePath = [
      options?.sourceDocumentTitle,
      label,
    ]
      .filter(Boolean)
      .join(" > ");

    return {
      id: row.id || `module-${index + 1}`,
      label,
      title: row.sequence || undefined,
      periodNumber: row.periodNumber ?? 1,
      startWeek: row.weekNumber ?? undefined,
      sessionCount,
      seanceLabels,
      competences: row.competences,
      objectifs: row.objectif ? [extractObjectifPrincipal(row.objectif)] : [],
      sourceDocumentId: options?.sourceDocumentId,
      sourcePath,
      importedRowId: row.id,
    };
  });
}

export function attachModuleSummariesToTables(
  tables: ProgrammingTable[],
  summaries: ProgrammationModuleSummary[],
): ProgrammingTable[] {
  if (summaries.length === 0) return tables;

  return tables.map((table) => ({
    ...table,
    metadata: {
      ...(table.metadata ?? {}),
      moduleSummaries: summaries,
    },
  }));
}

export function getModuleSummariesForTable(
  table: ProgrammingTable,
  programmationMetadata?: Record<string, unknown>,
): ProgrammationModuleSummary[] {
  const fromTable = table.metadata?.moduleSummaries;
  if (Array.isArray(fromTable) && fromTable.length > 0) {
    return fromTable as ProgrammationModuleSummary[];
  }

  const fromProgrammation = programmationMetadata?.moduleSummaries;
  if (Array.isArray(fromProgrammation) && fromProgrammation.length > 0) {
    return fromProgrammation as ProgrammationModuleSummary[];
  }

  return [];
}

export function summarizeModulesByPeriod(
  summaries: ProgrammationModuleSummary[],
): Map<number, ProgrammationModuleSummary[]> {
  const map = new Map<number, ProgrammationModuleSummary[]>();

  for (const summary of summaries) {
    const period = summary.periodNumber;
    const existing = map.get(period) ?? [];
    existing.push(summary);
    map.set(period, existing);
  }

  return map;
}
