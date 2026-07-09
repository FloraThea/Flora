import type { SeanceContext, SeanceDifferentiation } from "./types";

/**
 * Propose différenciation pour la séance sans dupliquer les données source.
 */
export class DifferentiationEngine {
  build(context: SeanceContext): SeanceDifferentiation {
    const methode = context.methode;
    const profile = context.teacherProfile.profile;

    const classFlags = [
      profile.ulis ? "ULIS" : null,
      profile.segpa ? "SEGPA" : null,
      profile.rep ? "REP" : null,
      profile.repPlus ? "REP+" : null,
    ].filter(Boolean);

    return {
      elevesFragiles: [
        "Étayages visuels et consignes fractionnées",
        "Temps supplémentaire en manipulation",
        methode ? `Supports de la méthode ${methode}` : "Trace intermédiaire guidée",
        ...classFlags.map((flag) => `Adaptation ${flag} si pertinent`),
      ],
      elevesAvances: [
        "Extension de complexité sur le même objectif",
        "Rôle de tuteur ou co-animateur",
        "Prolongement interdisciplinaire ou problème ouvert",
      ],
      groupesBesoins: [
        "Groupe guidé avec l'enseignant",
        "Groupe autonome avec critères explicites",
        "Binômes d'entraide",
      ],
      adaptations: [
        "Volume de production ajusté",
        "Supports différenciés issus de la bibliothèque",
        "Trace écrite allégée ou enrichie",
      ],
      variantes: [
        "Variante oral / manipulatif / écrit",
        "Variante individuelle / binôme / groupe",
      ],
    };
  }
}

export const differentiationEngine = new DifferentiationEngine();
