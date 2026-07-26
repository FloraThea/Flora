import {
  associateCompetencesFromCandidates,
  mapCandidatesFromReferentiel,
} from "@/lib/pedagogical/competence-association/associate-competences";
import { buildAssociationInputFromProgressionRow } from "@/lib/pedagogical/competence-association/build-input";
import type { SequenceContext } from "./types";

/**
 * Analyse la compétence BO et les attendus à partir de la progression et du référentiel.
 */
export class CompetenceAnalyzer {
  analyze(context: SequenceContext): {
    competenceBo: string;
    attendus: string[];
    prerequis: string[];
    referentielIds: string[];
    proposals: ReturnType<typeof associateCompetencesFromCandidates>["proposals"];
    associationConfidence: number;
    associationExplanation: string;
  } {
    const libraryContent = String(context.row.metadata?.libraryContent ?? "");
    const association = associateCompetencesFromCandidates({
      content: buildAssociationInputFromProgressionRow({
        row: context.row,
        matiere: context.tab.subjectLabel,
        niveau: context.niveau,
        cycle: context.cycle,
        sousMatiere: context.tab.subSubjectLabel,
        methode: context.methode,
        libraryContent,
        entityId: context.row.id,
      }),
      candidates: mapCandidatesFromReferentiel(context.referentiel),
      limit: 5,
      minConfidence: 0.45,
    });

    const primary = association.primary;
    const label = context.row.competenceBo;
    const legacyMatch = context.referentiel.find((item) => {
      const candidate = item.competence.toLowerCase();
      const normalized = label.toLowerCase();
      return candidate === normalized || candidate.includes(normalized) || normalized.includes(candidate);
    });

    const selected = primary ?? (legacyMatch
      ? {
          referentielId: legacyMatch.id,
          competenceText: legacyMatch.competence,
          confidence: 0.5,
          rank: 1,
          explanation: "Correspondance héritée du libellé de progression.",
          signals: {
            textSimilarity: 0.5,
            hierarchyMatch: 0,
            explicitLabel: 0.5,
            methodContext: 0,
            feedbackBoost: 0,
          },
          hierarchy: {
            cycle: context.cycle,
            niveau: context.niveau,
            matiere: context.tab.subjectLabel,
            sousMatiere: legacyMatch.domaine ?? "",
            sousSousMatiere: legacyMatch.sousDomaine ?? "",
          },
          status: "medium" as const,
        }
      : null);

    const attendus = selected
      ? [selected.competenceText, selected.hierarchy.sousMatiere, selected.hierarchy.matiere].filter(Boolean)
      : context.row.objectifs.slice(0, 2);

    const prerequis = context.row.objectifs.filter((objectif) =>
      /pr[eé]requis|apr[eè]s|avant/i.test(objectif),
    );

    const referentielIds = [
      ...(selected ? [selected.referentielId] : []),
      ...association.proposals.slice(1, 3).map((proposal) => proposal.referentielId),
      ...context.row.referentielIds,
    ].filter((value, index, array) => array.indexOf(value) === index);

    return {
      competenceBo: selected?.competenceText ?? label,
      attendus,
      prerequis,
      referentielIds,
      proposals: association.proposals,
      associationConfidence: selected?.confidence ?? 0,
      associationExplanation: selected?.explanation ?? "",
    };
  }
}

export const competenceAnalyzer = new CompetenceAnalyzer();
