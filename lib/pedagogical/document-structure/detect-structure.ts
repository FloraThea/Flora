import type { ImportedProgrammationRow } from "@/lib/programming/import/types";
import type { DocumentTree } from "@/lib/pedagogical/document-tree/types";
import {
  LIBRE_STRUCTURE,
  MHM_MATH_STRUCTURE,
  type DocumentStructure,
  type DocumentStructureKind,
  type SequenceGroupingLevel,
} from "./types";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isMhmMathematiques(methode?: string, matiere?: string, text?: string): boolean {
  const haystack = normalize(`${methode ?? ""} ${matiere ?? ""} ${text ?? ""}`);
  return /mhm/.test(haystack) && /(mathematiques|maths|math)/.test(haystack);
}

function countPattern(values: string[], pattern: RegExp): number {
  return values.filter((value) => pattern.test(normalize(value))).length;
}

function detectFromImportRows(rows: ImportedProgrammationRow[]): DocumentStructure | null {
  if (rows.length === 0) return null;

  const sequenceValues = rows.map((row) => row.sequence || row.domaine || "").filter(Boolean);
  const seanceValues = rows.map((row) => row.seance || "").filter(Boolean);

  const moduleHits = countPattern(sequenceValues, /\b(module|m\s*\d+|m\d+)\b/);
  const sequenceHits = countPattern(sequenceValues, /\bsequence\b/);
  const uniteHits = countPattern(sequenceValues, /\b(unite|unité)\b/);
  const projetHits = countPattern(sequenceValues, /\b(projet)\b/);
  const periodOnly =
    rows.every((row) => row.periodNumber != null) &&
    sequenceValues.every((value) => !value || /\bperiode\b/i.test(value));

  if (moduleHits >= Math.max(2, Math.ceil(rows.length * 0.3))) {
    return buildStructure("modules", "module", ["periode", "module", "seance"], [
      "import-module-labels",
    ]);
  }

  if (sequenceHits >= Math.max(2, Math.ceil(rows.length * 0.25))) {
    return buildStructure("sequences", "sequence", ["sequence", "seance"], [
      "import-sequence-labels",
    ]);
  }

  if (uniteHits >= 2) {
    return buildStructure("unites", "unite", ["unite", "seance"], ["import-unite-labels"]);
  }

  if (projetHits >= 2) {
    return buildStructure("projets", "projet", ["projet", "seance"], ["import-projet-labels"]);
  }

  if (periodOnly && rows.length >= 2) {
    return buildStructure("periodes", "periode", ["periode", "seance"], ["import-period-rows"]);
  }

  const sessionCountPattern = countPattern(seanceValues, /\d+\s*seances?/i);
  if (moduleHits >= 1 && sessionCountPattern >= 1) {
    return buildStructure("modules", "module", ["periode", "module", "seance"], [
      "import-module-with-session-count",
    ]);
  }

  return null;
}

function detectFromTree(tree: DocumentTree): DocumentStructure | null {
  const moduleCount = tree.moduleCount ?? 0;
  const seanceCount = tree.seanceCount ?? 0;

  const countType = (type: string) => {
    let count = 0;
    const walk = (nodes: DocumentTree["root"]["children"]) => {
      for (const node of nodes) {
        if (node.type === type) count += 1;
        walk(node.children);
      }
    };
    walk(tree.root.children);
    return count;
  };

  const sequenceCount = countType("sequence");
  const uniteCount = countType("unite");
  const chapitreCount = countType("chapitre");

  if (tree.signals.includes("mhm-guide-profile") || moduleCount >= 2) {
    return buildStructure("modules", "module", tree.hierarchyTemplate, [
      ...tree.signals,
      `modules:${moduleCount}`,
    ]);
  }

  if (sequenceCount >= 2) {
    return buildStructure("sequences", "sequence", tree.hierarchyTemplate, [
      ...tree.signals,
      `sequences:${sequenceCount}`,
    ]);
  }

  if (uniteCount >= 2) {
    return buildStructure("unites", "unite", tree.hierarchyTemplate, [
      ...tree.signals,
      `unites:${uniteCount}`,
    ]);
  }

  if (chapitreCount >= 2 && seanceCount >= 3) {
    return buildStructure("libre", "row", tree.hierarchyTemplate, [
      ...tree.signals,
      "chapitres-with-seances",
    ]);
  }

  if (seanceCount >= 3 && moduleCount === 0 && sequenceCount === 0) {
    return buildStructure("libre", "row", tree.hierarchyTemplate, [
      ...tree.signals,
      "seances-only",
    ]);
  }

  return null;
}

function buildStructure(
  kind: DocumentStructureKind,
  sequenceGrouping: SequenceGroupingLevel,
  levels: string[],
  signals: string[],
): DocumentStructure {
  const labels: DocumentStructure["labels"] = {};
  if (sequenceGrouping === "module") labels.module = "Module";
  if (sequenceGrouping === "sequence") labels.sequence = "Séquence";
  if (sequenceGrouping === "periode") labels.periode = "Période";
  if (sequenceGrouping === "unite") labels.unite = "Unité";
  if (sequenceGrouping === "projet") labels.projet = "Projet";

  return {
    kind,
    sequenceGrouping,
    levels,
    labels,
    signals,
    source: "detected",
  };
}

export function detectDocumentStructure(input: {
  methode?: string;
  matiere?: string;
  text?: string;
  filename?: string;
  rows?: ImportedProgrammationRow[];
  tree?: DocumentTree;
}): DocumentStructure {
  if (isMhmMathematiques(input.methode, input.matiere, `${input.text ?? ""} ${input.filename ?? ""}`)) {
    return { ...MHM_MATH_STRUCTURE };
  }

  if (input.tree) {
    const fromTree = detectFromTree(input.tree);
    if (fromTree) return fromTree;
  }

  if (input.rows && input.rows.length > 0) {
    const fromRows = detectFromImportRows(input.rows);
    if (fromRows) return fromRows;
  }

  if (input.text) {
    const normalized = normalize(input.text.slice(0, 12000));
    if (/\bmodule\s+\d+/i.test(normalized) && (normalized.match(/\bmodule\s+\d+/gi) ?? []).length >= 2) {
      return buildStructure("modules", "module", ["module", "seance"], ["text-module-headings"]);
    }
    if ((normalized.match(/\bs[eé]quence\s+\d+/gi) ?? []).length >= 2) {
      return buildStructure("sequences", "sequence", ["sequence", "seance"], ["text-sequence-headings"]);
    }
    if ((normalized.match(/\bunit[eé]\s+\d+/gi) ?? []).length >= 2) {
      return buildStructure("unites", "unite", ["unite", "seance"], ["text-unite-headings"]);
    }
    if ((normalized.match(/\bprojet\b/gi) ?? []).length >= 2) {
      return buildStructure("projets", "projet", ["projet", "seance"], ["text-projet-headings"]);
    }
  }

  return { ...LIBRE_STRUCTURE };
}

export function parseDocumentStructure(value: unknown): DocumentStructure | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const kind = record.kind;
  const sequenceGrouping = record.sequenceGrouping;
  if (typeof kind !== "string" || typeof sequenceGrouping !== "string") return null;

  return {
    kind: kind as DocumentStructure["kind"],
    sequenceGrouping: sequenceGrouping as DocumentStructure["sequenceGrouping"],
    levels: Array.isArray(record.levels) ? record.levels.map(String) : [],
    labels: (record.labels as DocumentStructure["labels"]) ?? {},
    signals: Array.isArray(record.signals) ? record.signals.map(String) : [],
    source: record.source === "method" || record.source === "manual" ? record.source : "detected",
  };
}

export function shouldRestituteFromStructure(structure: DocumentStructure): boolean {
  return structure.sequenceGrouping !== "row";
}
