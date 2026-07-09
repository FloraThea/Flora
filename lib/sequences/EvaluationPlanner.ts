import type { SequenceContext, SequenceEvaluation } from "./types";

/**
 * Construit le plan d'évaluation diagnostique, formative et sommative.
 */
export class EvaluationPlanner {
  plan(context: SequenceContext, sessionCount: number): {
    evaluations: SequenceEvaluation[];
    evaluationFinale: { label: string; criteres: string[] };
  } {
    const competence = context.row.competenceBo || "Compétence visée";
    const criteres = [
      `Mobiliser ${competence}`,
      "Respecter les consignes et la méthode",
      "Participer aux échanges et productions",
    ];

    const evaluations: SequenceEvaluation[] = [];

    if (context.row.periodNumber === 1 || context.row.weekNumber === 1) {
      evaluations.push({
        evaluationType: "diagnostic",
        label: "Évaluation diagnostique",
        criteres: ["Repérer les acquis initiaux", "Identifier les besoins"],
      });
    }

    for (let index = 1; index <= Math.max(1, sessionCount - 1); index += 1) {
      if (index % 2 === 0) {
        evaluations.push({
          evaluationType: "formative",
          label: `Évaluation formative — séance ${index}`,
          criteres: [`Vérifier la progression à la séance ${index}`, ...criteres.slice(0, 2)],
        });
      }
    }

    evaluations.push({
      evaluationType: "summative",
      label: "Évaluation sommative de séquence",
      criteres,
    });

    return {
      evaluations,
      evaluationFinale: {
        label: "Évaluation sommative de séquence",
        criteres,
      },
    };
  }
}

export const evaluationPlanner = new EvaluationPlanner();
