import type { SeanceContext, SeanceEvaluation } from "./types";

/**
 * Planifie l'évaluation formative de la séance.
 */
export class AssessmentPlanner {
  plan(context: SeanceContext): SeanceEvaluation {
    const objectif = context.sequenceSession.objectif;
    const competence = context.sequencePayload.sequence.competenceBo;

    return {
      formative: `Évaluation formative en cours de séance et en clôture, centrée sur : ${objectif}`,
      criteresReussite: [
        competence ? `Mobilisation de la compétence : ${competence}` : "Mobilisation de la compétence visée",
        "Participation active aux phases de recherche et de mise en commun",
        "Production ou verbalisation conforme à l'objectif",
      ],
      observables: [
        "Consignes comprises et mise en route autonome",
        "Justifications orales ou écrites pertinentes",
        "Trace écrite ou production finale exploitable",
      ],
      remediations: [
        "Reprise en petit groupe sur la phase de manipulation",
        "Consigne reformulée avec support visuel",
        "Exercice de consolidation différé en fin de séance ou au début de la suivante",
      ],
    };
  }
}

export const assessmentPlanner = new AssessmentPlanner();
