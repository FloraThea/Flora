import type { SequenceContext } from "./types";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Analyse la compétence BO et les attendus à partir de la progression et du référentiel.
 */
export class CompetenceAnalyzer {
  analyze(context: SequenceContext): {
    competenceBo: string;
    attendus: string[];
    prerequis: string[];
    referentielIds: string[];
  } {
    const label = context.row.competenceBo;
    const match = context.referentiel.find((item) => {
      const candidate = normalize(item.competence);
      const normalized = normalize(label);
      return (
        candidate === normalized ||
        candidate.includes(normalized) ||
        normalized.includes(candidate)
      );
    });

    const attendus = match
      ? [match.competence, match.domaine, match.discipline].filter(Boolean) as string[]
      : context.row.objectifs.slice(0, 2);

    const prerequis = context.row.objectifs.filter((objectif) =>
      /pr[eé]requis|apr[eè]s|avant/i.test(objectif),
    );

    return {
      competenceBo: match?.competence ?? label,
      attendus,
      prerequis,
      referentielIds: match?.id
        ? [match.id, ...context.row.referentielIds].filter(
            (value, index, array) => array.indexOf(value) === index,
          )
        : context.row.referentielIds,
    };
  }
}

export const competenceAnalyzer = new CompetenceAnalyzer();
