import { associateCompetences } from "@/lib/pedagogical/competence-association/associate-competences";
import { buildAssociationInputFromImportedRow } from "@/lib/pedagogical/competence-association/build-input";
import type { CompetencyMatchResult } from "./types";
import type { ImportedProgrammationRow } from "./types";

export async function matchImportedCompetencies(
  rows: ImportedProgrammationRow[],
  options?: { matiere?: string; niveau?: string; methode?: string },
): Promise<CompetencyMatchResult[]> {
  const results: CompetencyMatchResult[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const association = await associateCompetences({
      content: buildAssociationInputFromImportedRow({
        row,
        matiere: options?.matiere ?? row.discipline ?? "Français",
        niveau: options?.niveau ?? row.niveau,
        methode: options?.methode,
      }),
      limit: 3,
      minConfidence: 0.45,
    });

    for (const proposal of association.proposals) {
      const key = `${row.seance ?? row.sequence ?? "row"}:${proposal.referentielId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      results.push({
        importedLabel: row.competences[0] ?? row.objectif ?? row.seance ?? row.sequence ?? "Contenu importé",
        referentielId: proposal.referentielId,
        matchedLabel: proposal.competenceText,
        confidence: proposal.confidence,
        status:
          proposal.confidence >= 0.75 ? "matched" : proposal.confidence >= 0.45 ? "fuzzy" : "missing",
        explanation: proposal.explanation,
        rowKey: `${row.sequence ?? ""}|${row.seance ?? ""}`,
      });
    }

    for (const label of row.competences) {
      if (!label.trim()) continue;
      const existing = results.find((item) => item.importedLabel === label.trim());
      if (existing) continue;

      results.push({
        importedLabel: label.trim(),
        referentielId: association.primary?.referentielId ?? null,
        matchedLabel: association.primary?.competenceText ?? "",
        confidence: association.primary?.confidence ?? 0,
        status:
          (association.primary?.confidence ?? 0) >= 0.75
            ? "matched"
            : (association.primary?.confidence ?? 0) >= 0.45
              ? "fuzzy"
              : "missing",
        explanation: association.primary?.explanation,
        rowKey: `${row.sequence ?? ""}|${row.seance ?? ""}`,
      });
    }
  }

  return results;
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
