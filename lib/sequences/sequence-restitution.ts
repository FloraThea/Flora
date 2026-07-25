import { floraDb } from "@/lib/supabase/get-db";
import { loadProgression } from "@/lib/progression/progression-service";
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

function rowSessionObjectif(row: ProgressionRow): string {
  const primary = row.objectifs[0]?.trim();
  if (primary) return primary;
  return row.deroulement.trim();
}

export function shouldUseSequenceRestitution(input: {
  methode: string;
  progressionMetadata?: Record<string, unknown>;
}): boolean {
  if (/mhm/i.test(input.methode)) return true;
  return input.progressionMetadata?.restitutionMode === true;
}

export function groupProgressionRowsByModule(rows: ProgressionRow[]): Map<string, ProgressionRow[]> {
  const groups = new Map<string, ProgressionRow[]>();

  for (const row of rows) {
    const key = normalizeModuleKey(row.sequenceModule || row.seanceLabel);
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

export function findModuleRowsForAnchorRow(
  rows: ProgressionRow[],
  anchorRow: ProgressionRow,
): ProgressionRow[] {
  const moduleKey = normalizeModuleKey(anchorRow.sequenceModule);
  return rows
    .filter((row) => normalizeModuleKey(row.sequenceModule) === moduleKey)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function buildSequenceDraftFromModuleRows(input: {
  rows: ProgressionRow[];
  tab: ProgressionTab;
  context: SequenceContext;
}): SequenceDraft {
  const { rows, tab, context } = input;
  const moduleLabel = rows[0]?.sequenceModule || "Module";
  const presentation =
    rows[0]?.commentaires?.trim() ||
    rows[0]?.remarques?.trim() ||
    "";

  const sessions: SequenceSession[] = rows.map((row, index) => ({
    sessionNumber: row.sessionNumber || index + 1,
    title: row.seanceLabel || `Séance ${index + 1}`,
    objectif: rowSessionObjectif(row),
    dureeMinutes: 45,
    ordrePedagogique: index + 1,
    placeProgression: `Période ${row.periodNumber} · Semaine ${row.weekNumber} · ${row.sequenceModule}`,
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
    },
  }));

  const allObjectifs = rows.flatMap((row) => row.objectifs).filter(Boolean);
  const allMateriel = [...new Set(rows.flatMap((row) => row.materiel).filter(Boolean))];
  const allResources = [...new Set(rows.flatMap((row) => row.resources).filter(Boolean))];
  const allCompetences = [...new Set(rows.map((row) => row.competenceBo).filter(Boolean))];

  return {
    title: moduleLabel,
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

export async function loadAllProgressionRows(progressionId: string): Promise<{
  rows: ProgressionRow[];
  tabs: ProgressionTab[];
}> {
  const payload = await loadProgression(progressionId);
  if (!payload) {
    throw new Error("Progression introuvable.");
  }

  const tabs = payload.tabs;
  const rows = tabs.flatMap((tab) => tab.rows);
  return { rows, tabs };
}

export function normalizeSequenceModuleKey(label: string): string {
  return normalizeModuleKey(label);
}

export async function findExistingModuleSequence(input: {
  progressionId: string;
  sequenceModule: string;
}): Promise<string | null> {
  const moduleKey = normalizeModuleKey(input.sequenceModule);
  const { data } = await (await floraDb())
    .from("sequences")
    .select("id, metadata, title")
    .eq("progression_id", input.progressionId)
    .is("deleted_at", null);

  for (const row of data ?? []) {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    const storedKey = String(metadata.sequenceModuleKey ?? "");
    const storedModule = String(metadata.sequenceModule ?? row.title ?? "");
    if (storedKey === moduleKey || normalizeModuleKey(storedModule) === moduleKey) {
      return String(row.id);
    }
  }

  return null;
}
