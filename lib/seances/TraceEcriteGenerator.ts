import type { SeanceContext, SeanceTraceEcrite } from "./types";

/**
 * Génère les traces écrites enseignant / élève.
 */
export class TraceEcriteGenerator {
  build(context: SeanceContext): SeanceTraceEcrite {
    const sequence = context.sequencePayload.sequence;
    const objectif = context.sequenceSession.objectif;
    const notions = sequence.notions.slice(0, 3);
    const vocabulaire = sequence.vocabulaire.slice(0, 4);

    const leconTitle = `${sequence.sousMatiere || sequence.matiere} — ${context.sequenceSession.title}`;

    return {
      enseignant: [
        `# ${leconTitle}`,
        `Objectif : ${objectif}`,
        notions.length ? `Notions : ${notions.join(", ")}` : "",
        vocabulaire.length ? `Vocabulaire : ${vocabulaire.join(", ")}` : "",
        sequence.competenceBo ? `Compétence BO : ${sequence.competenceBo}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      eleve: [
        `Titre : ${leconTitle}`,
        `Aujourd'hui, j'ai appris : ${objectif}`,
        notions.length ? `Notions clés : ${notions.join(" · ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      lecon: `Leçon — ${leconTitle}\n\n${objectif}\n\n${notions.map((n) => `• ${n}`).join("\n")}`,
      aideMemoire: [
        vocabulaire.length ? `Mots clés : ${vocabulaire.join(" · ")}` : "",
        sequence.competenceBo ? `Je sais : ${sequence.competenceBo}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }
}

export const traceEcriteGenerator = new TraceEcriteGenerator();
