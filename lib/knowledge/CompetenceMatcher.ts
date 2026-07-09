import { listReferentielRows } from "@/lib/referentiel/referentiel-service";
import type { BoMatchDraft, ReferentielRow } from "./types";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalize(value)
    .split(" ")
    .filter((token) => token.length > 2);
}

function similarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) intersection += 1;
  });

  return intersection / Math.max(tokensA.size, tokensB.size);
}

/**
 * Relie les compétences extraites au référentiel BO existant dans Supabase.
 */
export class CompetenceMatcher {
  async loadReferentiels(): Promise<ReferentielRow[]> {
    const rows = await listReferentielRows();
    console.info("[knowledge] Référentiel BO chargé pour matching", {
      count: rows.length,
    });

    return rows.map((row) => ({
      id: row.id,
      competence: row.competence ?? "",
      code: row.code ?? null,
      discipline: row.discipline ?? null,
      domaine: row.domaine ?? null,
      niveau: row.niveau ?? null,
      cycle: row.cycle ?? null,
    }));
  }

  matchCompetence(
    label: string,
    referentiels: ReferentielRow[],
  ): BoMatchDraft {
    const normalizedLabel = normalize(label);
    let best: BoMatchDraft = {
      competenceLabel: label,
      referentielId: null,
      matchedLabel: "",
      confidence: 0,
      matchMethod: "none",
    };

    for (const row of referentiels) {
      const candidate = row.competence ?? "";
      if (!candidate) continue;

      const normalizedCandidate = normalize(candidate);
      let score = 0;
      let method: BoMatchDraft["matchMethod"] = "fuzzy";

      if (normalizedLabel === normalizedCandidate) {
        score = 1;
        method = "exact";
      } else if (
        normalizedLabel.includes(normalizedCandidate) ||
        normalizedCandidate.includes(normalizedLabel)
      ) {
        score = 0.92;
        method = "exact";
      } else {
        score = similarity(label, candidate);
        method = "fuzzy";
      }

      if (row.code && normalizedLabel.includes(normalize(row.code))) {
        score = Math.max(score, 0.95);
        method = "exact";
      }

      if (score > best.confidence) {
        best = {
          competenceLabel: label,
          referentielId: row.id,
          matchedLabel: candidate,
          confidence: Number(score.toFixed(2)),
          matchMethod: method,
        };
      }
    }

    return best;
  }

  async matchEntities(
    entities: Array<{ tempId: string; label: string; entityType: string }>,
  ): Promise<BoMatchDraft[]> {
    const referentiels = await this.loadReferentiels();

    return entities
      .filter((entity) => entity.entityType === "competence")
      .map((entity) => ({
        entityTempId: entity.tempId,
        ...this.matchCompetence(entity.label, referentiels),
      }))
      .filter((match) => match.confidence >= 0.45);
  }
}

export const competenceMatcher = new CompetenceMatcher();
