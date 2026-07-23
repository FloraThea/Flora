import type { ParsedLessonSession } from "@/lib/pedagogical/import/lesson-document-parser";
import { LESSON_PHASES, type SeanceDraft, type SeancePhase } from "../types";

function defaultMaterial(items: string[]) {
  return {
    guides: items,
    albums: [],
    affichages: [],
    manipulation: [],
    videoprojecteur: [],
    photocopies: [],
    fiches: [],
    cartes: [],
    jeux: [],
    autres: [],
  };
}

function mapPhases(session: ParsedLessonSession): SeancePhase[] {
  if (session.phases.length > 0) {
    return session.phases.map((phase, index) => ({
      phaseKey: LESSON_PHASES[index % LESSON_PHASES.length]!.key,
      title: phase.title,
      sortOrder: index + 1,
      dureeMinutes: Math.max(5, Math.round((session.dureeMinutes.value || 45) / session.phases.length)),
      summary: phase.content,
      activities: phase.content
        ? [
            {
              sortOrder: 1,
              objectif: session.objectif.value,
              consignesEnseignant: phase.content,
              consignesEleves: "",
              organisation: "",
              dureeMinutes: Math.max(5, Math.round((session.dureeMinutes.value || 45) / session.phases.length)),
              variablesPedagogiques: [],
              questions: [],
              reponsesAttendues: [],
              erreursFrequentes: [],
              remediations: [],
            },
          ]
        : [],
    }));
  }

  if (session.deroulement.value.trim()) {
    return [
      {
        phaseKey: "manipulation",
        title: "Déroulement",
        sortOrder: 1,
        dureeMinutes: session.dureeMinutes.value || 45,
        summary: session.deroulement.value,
        activities: [
          {
            sortOrder: 1,
            objectif: session.objectif.value,
            consignesEnseignant: session.deroulement.value,
            consignesEleves: "",
            organisation: "",
            dureeMinutes: session.dureeMinutes.value || 45,
            variablesPedagogiques: [],
            questions: [],
            reponsesAttendues: [],
            erreursFrequentes: [],
            remediations: [],
          },
        ],
      },
    ];
  }

  return [];
}

export function mapParsedSessionToDraft(
  session: ParsedLessonSession,
  defaults?: {
    matiere?: string;
    sousMatiere?: string;
    niveau?: string;
    methode?: string;
    periodNumber?: number;
    weekNumber?: number;
  },
): SeanceDraft {
  return {
    title: session.title.value || `Séance ${session.sessionNumber}`,
    matiere: defaults?.matiere ?? "",
    sousMatiere: defaults?.sousMatiere ?? "",
    niveau: defaults?.niveau ?? "",
    cycle: "",
    periodNumber: defaults?.periodNumber ?? 1,
    weekNumber: defaults?.weekNumber ?? session.sessionNumber,
    sessionDate: session.date.value,
    dureeMinutes: session.dureeMinutes.value || 45,
    competenceBo: session.competence.value,
    objectif: session.objectif.value,
    prerequis: [],
    methode: defaults?.methode ?? "",
    resourceIds: [],
    referentielIds: [],
    resources: session.ressources.value,
    materiel: defaultMaterial(session.materiel.value),
    differentiation: {
      elevesFragiles: session.differentiation.value ? [session.differentiation.value] : [],
      elevesAvances: [],
      groupesBesoins: [],
      adaptations: [],
      variantes: [],
    },
    evaluation: {
      formative: session.evaluation.value,
      criteresReussite: [],
      observables: [],
      remediations: [],
    },
    homework: {
      devoirs: [],
      revisions: [],
      lecture: [],
      entrainement: [],
    },
    traceEcrite: {
      enseignant: "",
      eleve: "",
      lecon: session.objectif.value,
      aideMemoire: "",
    },
    pedagogicalChoices: [],
    phases: mapPhases(session),
  };
}

export function mapParsedImportToSeanceDrafts(
  sessions: ParsedLessonSession[],
  defaults?: {
    matiere?: string;
    sousMatiere?: string;
    niveau?: string;
    methode?: string;
    periodNumber?: number;
    weekNumber?: number;
  },
): SeanceDraft[] {
  return sessions.map((session) => mapParsedSessionToDraft(session, defaults));
}
