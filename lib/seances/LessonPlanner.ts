import type { LessonPhaseKey, SeanceContext, SeancePhase } from "./types";
import { LESSON_PHASES } from "./types";

/**
 * Répartit la durée de la séance sur les phases du déroulé.
 */
export class LessonPlanner {
  buildPhases(context: SeanceContext): SeancePhase[] {
    const totalMinutes = context.sequenceSession.dureeMinutes;
    const objectif = context.sequenceSession.objectif;
    const methode = context.methode;

    return LESSON_PHASES.map((phase, index) => {
      const dureeMinutes = Math.max(3, Math.round(totalMinutes * phase.weight));

      return {
        phaseKey: phase.key,
        title: phase.label,
        sortOrder: index + 1,
        dureeMinutes,
        summary: this.buildPhaseSummary(phase.key, objectif, methode),
        activities: [],
      };
    });
  }

  private buildPhaseSummary(phaseKey: LessonPhaseKey, objectif: string, methode: string): string {
    const summaries: Record<LessonPhaseKey, string> = {
      accueil: "Accueil ritualisé, consignes d'organisation et annonce de l'objectif.",
      rappel: "Réactivation des prérequis et rappel des notions utiles à la séance.",
      manipulation: "Exploration concrète ou manipulation guidée en lien avec l'objectif.",
      recherche: "Recherche autonome ou guidée avec consignes explicites.",
      mise_en_commun: "Partage des découvertes et verbalisation collective.",
      institutionnalisation: "Formalisation des apprentissages et trace partagée.",
      entrainement: "Exercices d'entraînement ciblés sur l'objectif.",
      reinvestissement: "Application dans une situation proche ou variée.",
      synthese: "Bilan de séance et auto-évaluation rapide.",
      trace_ecrite: "Production ou complétion de la trace écrite.",
    };

    const base = summaries[phaseKey];
    return methode
      ? `${base} Méthode ${methode} : respecter la structure imposée. Objectif : ${objectif}.`
      : `${base} Objectif : ${objectif}.`;
  }
}

export const lessonPlanner = new LessonPlanner();
