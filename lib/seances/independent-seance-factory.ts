import {
  LESSON_PHASES,
  type IndependentSeanceCreateInput,
  type SeanceDraft,
  type SeanceMaterial,
  type SeancePhase,
} from "./types";

const EMPTY_MATERIAL: SeanceMaterial = {
  guides: [],
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

export function buildEmptySeancePhases(dureeMinutes: number): SeancePhase[] {
  return LESSON_PHASES.map((phase, index) => {
    const phaseDuration = Math.max(1, Math.round(dureeMinutes * phase.weight));
    return {
      phaseKey: phase.key,
      title: phase.label,
      sortOrder: index,
      dureeMinutes: phaseDuration,
      summary: "",
      activities: [
        {
          sortOrder: 0,
          objectif: "",
          consignesEnseignant: "",
          consignesEleves: "",
          organisation: "",
          dureeMinutes: phaseDuration,
          variablesPedagogiques: [],
          questions: [],
          reponsesAttendues: [],
          erreursFrequentes: [],
          remediations: [],
        },
      ],
    };
  });
}

export function buildIndependentSeanceDraft(input: IndependentSeanceCreateInput): SeanceDraft {
  const dureeMinutes = input.dureeMinutes ?? 45;

  return {
    title: input.title.trim(),
    matiere: input.matiere.trim(),
    sousMatiere: input.sousMatiere?.trim() ?? "",
    niveau: input.niveau?.trim() ?? "",
    cycle: input.cycle?.trim() ?? "",
    periodNumber: input.periodNumber ?? 0,
    weekNumber: input.weekNumber ?? 0,
    sessionDate: input.sessionDate ?? null,
    dureeMinutes,
    competenceBo: input.competenceBo?.trim() ?? "",
    objectif: input.objectif?.trim() ?? "",
    prerequis: input.prerequis ?? [],
    methode: input.methode ?? "",
    resourceIds: [],
    referentielIds: [],
    resources: input.resources ?? [],
    materiel: { ...EMPTY_MATERIAL, autres: input.materiel ?? [] },
    differentiation: {
      elevesFragiles: [],
      elevesAvances: [],
      groupesBesoins: [],
      adaptations: [],
      variantes: [],
    },
    evaluation: {
      formative: input.evaluation ?? "",
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
      lecon: "",
      aideMemoire: "",
    },
    pedagogicalChoices: [],
    phases: buildEmptySeancePhases(dureeMinutes),
  };
}

export function resolveSeanceLinkMode(input: IndependentSeanceCreateInput): "linked" | "independent" {
  if (input.sequenceId && input.sequenceSessionId) return "linked";
  return "independent";
}
