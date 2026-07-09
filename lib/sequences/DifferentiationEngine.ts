import type { SequenceContext, SequenceDifferentiation } from "./types";

/**
 * Propose différenciation pédagogique sans dupliquer les données source.
 */
export class DifferentiationEngine {
  build(context: SequenceContext): SequenceDifferentiation {
    const methode = context.methode || context.progression.methode;

    return {
      elevesEnDifficulte: [
        "Proposer des étayages visuels et des traces écrites simplifiées",
        "Fractionner les consignes et prévoir un temps de manipulation supplémentaire",
        methode ? `Réutiliser les supports de la méthode ${methode}` : "Réinvestir les rituels de classe",
      ],
      elevesAvances: [
        "Proposer une extension de complexité sur le même objectif",
        "Confier un rôle de tutorat ou de co-construction",
        "Ouvrir vers un prolongement interdisciplinaire",
      ],
      groupes: [
        "Groupe guidé avec l'enseignant",
        "Groupe autonome avec critères de réussite explicites",
        "Binômes de entraide",
      ],
      adaptations: [
        "Adapter le volume de production attendu",
        "Proposer des supports différenciés issus de la bibliothèque",
        "Prévoir une trace écrite allégée ou enrichie selon le profil",
      ],
    };
  }
}

export const differentiationEngine = new DifferentiationEngine();
