import type { SeanceContext, SeanceHomework } from "./types";

/**
 * Propose devoirs et révisions si pertinent pour la séance.
 */
export class HomeworkGenerator {
  build(context: SeanceContext): SeanceHomework {
    const sequence = context.sequencePayload.sequence;
    const matiere = sequence.matiere.toLowerCase();
    const isFrench = matiere.includes("français");
    const isMath = matiere.includes("math");

    const devoirs: string[] = [];
    const revisions: string[] = [];
    const lecture: string[] = [];
    const entrainement: string[] = [];

    if (isFrench) {
      devoirs.push("Compléter ou relire la trace écrite");
      lecture.push("Lecture suivie ou individuelle liée à la séquence");
      entrainement.push("Exercice d'orthographe ou de grammaire ciblé");
    }

    if (isMath) {
      devoirs.push("Terminer les exercices non faits en classe");
      entrainement.push("Série courte de calcul mental ou de problèmes");
      revisions.push("Revoir les notions de la séance avec un adulte");
    }

    if (devoirs.length === 0 && sequence.prolongements.length > 0) {
      devoirs.push(`Prolongement : ${sequence.prolongements[0]}`);
    }

    if (revisions.length === 0 && sequence.prerequis.length > 0) {
      revisions.push(`Réviser : ${sequence.prerequis[0]}`);
    }

    return { devoirs, revisions, lecture, entrainement };
  }
}

export const homeworkGenerator = new HomeworkGenerator();
