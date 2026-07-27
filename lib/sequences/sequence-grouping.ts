import { shouldRestituteFromStructure } from "@/lib/pedagogical/document-structure/detect-structure";
import { buildSessionDetailFromProgressionRow, serializeSessionPreparationDetail } from "@/lib/pedagogical/preparation/deroulement-utils";
import { resolveProgressionStructureSync } from "@/lib/pedagogical/document-structure/resolve-structure-sync";
import type { DocumentStructure, SequenceGroupingLevel } from "@/lib/pedagogical/document-structure/types";
import type { ProgressionRow, ProgressionTab } from "@/lib/progression/types";
import type { SequenceContext, SequenceDraft, SequenceSession } from "./types";

function normalizeModuleKey(label: string): string {
  const trimmed = label.trim();
  const moduleMatch = trimmed.match(/module\s*(\d+)/i);
  if (moduleMatch) return `module-${moduleMatch[1]}`;

  const shortMatch = trimmed.match(/^m\s*(\d+)\b/i);
  if (shortMatch) return `module-${shortMatch[1]}`;

  return trimmed.toLowerCase();
}

function normalizeSequenceKey(label: string): string {
  const match = label.trim().match(/s[eé]quence\s*(\d+)/i);
  if (match) return `sequence-${match[1]}`;
  return label.trim().toLowerCase();
}

function normalizeUniteKey(label: string): string {
  const match = label.trim().match(/unit[eé]\s*(\d+)/i);
  if (match) return `unite-${match[1]}`;
  return label.trim().toLowerCase();
}

function normalizeProjetKey(label: string): string {
  const match = label.trim().match(/projet\s*(\d+)/i);
  if (match) return `projet-${match[1]}`;
  return label.trim().toLowerCase();
}

export function normalizeGroupKey(
  label: string,
  grouping: SequenceGroupingLevel,
  row?: ProgressionRow,
): string {
  switch (grouping) {
    case "module":
      return normalizeModuleKey(label);
    case "sequence":
      return normalizeSequenceKey(label);
    case "periode":
      return row ? `periode-${row.periodNumber}` : label.trim().toLowerCase();
    case "unite":
      return normalizeUniteKey(label);
    case "projet":
      return normalizeProjetKey(label);
    case "row":
      return row?.id ?? `row-${row?.sortOrder ?? label}`;
    default:
      return label.trim().toLowerCase();
  }
}

export function resolveGroupLabel(row: ProgressionRow, grouping: SequenceGroupingLevel): string {
  switch (grouping) {
    case "periode":
      return `Période ${row.periodNumber}`;
    case "row":
      return row.seanceLabel || `Séance ${row.sessionNumber || row.sortOrder + 1}`;
    default:
      return row.sequenceModule || row.seanceLabel;
  }
}

function rowSessionObjectif(row: ProgressionRow): string {
  const primary = row.objectifs[0]?.trim();
  if (primary) return primary;
  return row.deroulement.trim();
}

export function shouldUseSequenceRestitution(input: {
  methode?: string;
  matiere?: string;
  progressionMetadata?: Record<string, unknown>;
  structure?: DocumentStructure;
}): boolean {
  if (input.progressionMetadata?.restitutionMode === true) return true;

  const structure =
    input.structure ??
    resolveProgressionStructureSync({
      progressionMetadata: input.progressionMetadata,
      methode: input.methode,
      matiere: input.matiere,
    });

  return shouldRestituteFromStructure(structure);
}

export function groupProgressionRowsByStructure(
  rows: ProgressionRow[],
  structure: DocumentStructure,
): Map<string, ProgressionRow[]> {
  const groups = new Map<string, ProgressionRow[]>();

  for (const row of rows) {
    const label = resolveGroupLabel(row, structure.sequenceGrouping);
    const key = normalizeGroupKey(label, structure.sequenceGrouping, row);
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  for (const [key, list] of groups.entries()) {
    groups.set(
      key,
      [...list].sort((left, right) => left.sortOrder - right.sortOrder),
    );
  }

  return groups;
}

export function groupProgressionRowsByModule(rows: ProgressionRow[]): Map<string, ProgressionRow[]> {
  return groupProgressionRowsByStructure(rows, {
    kind: "modules",
    sequenceGrouping: "module",
    levels: ["module", "seance"],
    labels: { module: "Module" },
    signals: ["legacy-module-grouping"],
    source: "detected",
  });
}

export function findGroupedRowsForAnchorRow(
  rows: ProgressionRow[],
  anchorRow: ProgressionRow,
  structure: DocumentStructure,
): ProgressionRow[] {
  const label = resolveGroupLabel(anchorRow, structure.sequenceGrouping);
  const anchorKey = normalizeGroupKey(label, structure.sequenceGrouping, anchorRow);

  return rows
    .filter((row) => {
      const rowLabel = resolveGroupLabel(row, structure.sequenceGrouping);
      return normalizeGroupKey(rowLabel, structure.sequenceGrouping, row) === anchorKey;
    })
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function findModuleRowsForAnchorRow(
  rows: ProgressionRow[],
  anchorRow: ProgressionRow,
): ProgressionRow[] {
  return findGroupedRowsForAnchorRow(rows, anchorRow, {
    kind: "modules",
    sequenceGrouping: "module",
    levels: ["module", "seance"],
    labels: { module: "Module" },
    signals: ["legacy-module-grouping"],
    source: "detected",
  });
}

export function buildSequenceDraftFromGroupedRows(input: {
  rows: ProgressionRow[];
  tab: ProgressionTab;
  context: SequenceContext;
  structure: DocumentStructure;
}): SequenceDraft {
  const { rows, tab, context, structure } = input;
  const groupLabel = resolveGroupLabel(rows[0] ?? context.row, structure.sequenceGrouping);
  const presentation =
    rows[0]?.commentaires?.trim() ||
    rows[0]?.remarques?.trim() ||
    "";

  const sessions: SequenceSession[] = rows.map((row, index) => {
    const sessionDetail = buildSessionDetailFromProgressionRow({
      competenceBo: row.competenceBo,
      objectifs: row.objectifs,
      deroulement: row.deroulement,
      materiel: row.materiel,
      resources: row.resources,
      referentielIds: row.referentielIds,
    });

    return {
      sessionNumber: row.sessionNumber || index + 1,
      title: row.seanceLabel || `Séance ${index + 1}`,
      objectif: rowSessionObjectif(row),
      dureeMinutes: 45,
      ordrePedagogique: index + 1,
      placeProgression: `Période ${row.periodNumber} · Semaine ${row.weekNumber} · ${row.sequenceModule || groupLabel}`,
      metadata: {
        progressionRowId: row.id,
        competenceBo: row.competenceBo,
        objectifs: row.objectifs,
        deroulement: row.deroulement,
        materiel: row.materiel,
        resources: row.resources,
        remarques: row.remarques,
        commentaires: row.commentaires,
        rowMetadata: row.metadata ?? {},
        ...serializeSessionPreparationDetail(sessionDetail),
      },
    };
  });

  const allObjectifs = rows.flatMap((row) => row.objectifs).filter(Boolean);
  const allMateriel = [...new Set(rows.flatMap((row) => row.materiel).filter(Boolean))];
  const allResources = [...new Set(rows.flatMap((row) => row.resources).filter(Boolean))];
  const allCompetences = [...new Set(rows.map((row) => row.competenceBo).filter(Boolean))];

  return {
    title: groupLabel,
    matiere: tab.subjectLabel,
    sousMatiere: tab.subSubjectLabel || tab.subjectLabel,
    cycle: context.cycle,
    niveau: context.niveau,
    periodNumber: rows[0]?.periodNumber ?? context.row.periodNumber,
    weekNumbers: [...new Set(rows.map((row) => row.weekNumber))],
    competenceBo: allCompetences[0] ?? context.row.competenceBo,
    attendus: allCompetences,
    objectifs: presentation ? [presentation, ...allObjectifs] : allObjectifs,
    dureeEstimeeMinutes: sessions.length * 45,
    sessionCount: sessions.length,
    prerequis: [],
    notions: allObjectifs,
    vocabulaire: [],
    materiel: allMateriel,
    resources: allResources,
    methode: context.methode,
    evaluationFinale: {
      label: "",
      criteres: [],
    },
    differentiation: {
      elevesEnDifficulte: [],
      elevesAvances: [],
      groupes: [],
      adaptations: [],
    },
    prolongements: rows.map((row) => row.remarques).filter(Boolean),
    referentielIds: [...new Set(rows.flatMap((row) => row.referentielIds))],
    resourceIds: [...new Set(rows.flatMap((row) => row.resourceIds))],
    sessions,
    evaluations: [],
  };
}

export function buildSequenceDraftFromModuleRows(input: {
  rows: ProgressionRow[];
  tab: ProgressionTab;
  context: SequenceContext;
}): SequenceDraft {
  return buildSequenceDraftFromGroupedRows({
    ...input,
    structure: {
      kind: "modules",
      sequenceGrouping: "module",
      levels: ["module", "seance"],
      labels: { module: "Module" },
      signals: ["legacy-module-grouping"],
      source: "detected",
    },
  });
}

export function normalizeSequenceGroupKey(
  label: string,
  grouping: SequenceGroupingLevel = "module",
  row?: ProgressionRow,
): string {
  return normalizeGroupKey(label, grouping, row);
}

export function normalizeSequenceModuleKey(label: string): string {
  return normalizeModuleKey(label);
}
