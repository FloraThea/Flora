import type { SeanceActivity, SeanceContext, SeancePhase } from "./types";

/**
 * Génère les activités pédagogiques pour chaque phase du déroulé.
 */
export class ActivityGenerator {
  buildActivities(context: SeanceContext, phases: SeancePhase[]): SeancePhase[] {
    const objectif = context.sequenceSession.objectif;
    const matiere = context.sequencePayload.sequence.matiere;
    const competence = context.sequencePayload.sequence.competenceBo;

    return phases.map((phase) => ({
      ...phase,
      activities: [
        this.buildActivity(phase, objectif, matiere, competence, context.methode),
      ],
    }));
  }

  private buildActivity(
    phase: SeancePhase,
    objectif: string,
    matiere: string,
    competence: string,
    methode: string,
  ): SeanceActivity {
    const phaseLabel = phase.title.toLowerCase();

    return {
      sortOrder: 1,
      objectif: `${phase.title} — ${objectif}`,
      consignesEnseignant: `Animer la phase « ${phase.title} » en veillant au lien avec la compétence : ${competence || "référentiel BO"}. ${methode ? `Respecter la logique de la méthode ${methode}.` : ""}`,
      consignesEleves: this.buildStudentInstructions(phase.phaseKey, matiere),
      organisation: this.buildOrganisation(phase.phaseKey),
      dureeMinutes: phase.dureeMinutes,
      variablesPedagogiques: [
        `Phase : ${phaseLabel}`,
        `Durée : ${phase.dureeMinutes} min`,
        matiere ? `Matière : ${matiere}` : "Matière : voir séquence",
      ],
      questions: this.buildQuestions(phase.phaseKey, objectif),
      reponsesAttendues: [
        "Les élèves mobilisent les notions attendues pour la phase.",
        "Les productions ou verbalisations restent alignées sur l'objectif.",
      ],
      erreursFrequentes: [
        "Consignes trop longues ou peu explicites",
        "Temps de manipulation insuffisant",
        "Trace écrite rédigée avant l'institutionnalisation",
      ],
      remediations: [
        "Fractionner la consigne et modéliser la première étape",
        "Proposer un support visuel ou une trace intermédiaire",
        "Prévoir un binôme tutoré pour les élèves fragiles",
      ],
    };
  }

  private buildStudentInstructions(phaseKey: string, matiere: string): string {
    const map: Record<string, string> = {
      accueil: "Je m'installe, j'écoute les consignes et je prépare mon matériel.",
      rappel: "Je réponds aux questions de rappel et je réactive mes connaissances.",
      manipulation: "Je manipule le matériel et j'explore la situation proposée.",
      recherche: "Je cherche, j'observe et je note mes découvertes.",
      mise_en_commun: "Je partage mes idées et j'écoute celles des autres.",
      institutionnalisation: "Je participe à la formalisation et je complète ma trace.",
      entrainement: "Je m'entraîne sur les exercices proposés.",
      reinvestissement: "J'applique ce que j'ai appris dans une nouvelle situation.",
      synthese: "Je fais le bilan de ce que j'ai appris aujourd'hui.",
      trace_ecrite: "Je rédige ou complète ma trace écrite.",
    };

    return map[phaseKey] ?? `Je participe à la phase en ${matiere}.`;
  }

  private buildOrganisation(phaseKey: string): string {
    const map: Record<string, string> = {
      accueil: "Classe entière — rang ou cercle",
      rappel: "Classe entière — questions-réponses",
      manipulation: "Individuel ou binômes — tables",
      recherche: "Binômes ou trinômes — autonomie guidée",
      mise_en_commun: "Classe entière — verbalisation au tableau",
      institutionnalisation: "Classe entière — co-construction au tableau",
      entrainement: "Individuel — fiches ou cahier",
      reinvestissement: "Petits groupes ou individuel",
      synthese: "Classe entière — tour de parole ou exit ticket",
      trace_ecrite: "Individuel — cahier ou fiche",
    };

    return map[phaseKey] ?? "Organisation adaptée à la phase";
  }

  private buildQuestions(phaseKey: string, objectif: string): string[] {
    return [
      `Qu'observez-vous dans cette phase ?`,
      `En quoi cela contribue-t-il à : ${objectif} ?`,
      phaseKey === "synthese" ? "Qu'avez-vous appris aujourd'hui ?" : "Que pouvez-vous expliquer à un camarade ?",
    ];
  }
}

export const activityGenerator = new ActivityGenerator();
