import type { ReferentielCompetence } from "@/lib/programming/types";
import type { LearningItem } from "./types";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Ordonne les compétences selon le référentiel BO et la progressivité naturelle.
 */
export class CompetenceSequencer {
  sequence(items: LearningItem[], referentiel: ReferentielCompetence[]): LearningItem[] {
    const competenceItems = items.filter((item) => item.type === "competence");

    const sortedCompetences = [...competenceItems].sort((left, right) => {
      const leftRef = this.findReferentiel(left.label, referentiel);
      const rightRef = this.findReferentiel(right.label, referentiel);

      const leftCode = leftRef?.code ?? left.label;
      const rightCode = rightRef?.code ?? right.label;

      return leftCode.localeCompare(rightCode, "fr", { numeric: true });
    });

    const merged: LearningItem[] = [];
    let competenceIndex = 0;

    items.forEach((item) => {
      if (item.type !== "competence") {
        merged.push(item);
        return;
      }

      const next = sortedCompetences[competenceIndex];
      if (next) merged.push(next);
      competenceIndex += 1;
    });

    if (merged.length === 0) {
      return [...items].sort((a, b) => a.order - b.order);
    }

    return merged.map((item, index) => ({ ...item, order: index }));
  }

  private findReferentiel(label: string, referentiel: ReferentielCompetence[]) {
    const normalized = normalize(label);
    return referentiel.find((item) => {
      const candidate = normalize(item.competence);
      return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
    });
  }
}

export const competenceSequencer = new CompetenceSequencer();
