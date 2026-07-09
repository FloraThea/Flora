import { CompetenceMatcher } from "@/lib/knowledge/CompetenceMatcher";
import type { CompetencyMatchResult } from "./types";
import type { ImportedProgrammationRow } from "./types";

const matcher = new CompetenceMatcher();

export async function matchImportedCompetencies(
  rows: ImportedProgrammationRow[],
): Promise<CompetencyMatchResult[]> {
  const referentiels = await matcher.loadReferentiels();
  const labels = new Set<string>();

  for (const row of rows) {
    for (const competence of row.competences) {
      if (competence.trim()) labels.add(competence.trim());
    }
  }

  return [...labels].map((label) => {
    const match = matcher.matchCompetence(label, referentiels);
    return {
      importedLabel: label,
      referentielId: match.referentielId,
      matchedLabel: match.matchedLabel,
      confidence: match.confidence,
      status:
        match.confidence >= 0.9
          ? "matched"
          : match.confidence >= 0.45
            ? "fuzzy"
            : "missing",
    };
  });
}

export function applyCompetencyMatchesToRows(
  rows: ImportedProgrammationRow[],
  matches: CompetencyMatchResult[],
): ImportedProgrammationRow[] {
  const matchMap = new Map(matches.map((item) => [item.importedLabel, item]));

  return rows.map((row) => ({
    ...row,
    competences: row.competences.map((label) => {
      const match = matchMap.get(label);
      if (match?.matchedLabel && match.confidence >= 0.45) {
        return match.matchedLabel;
      }
      return label;
    }),
  }));
}
