import type { IndependentSequenceCreateInput, SequenceDraft, SequenceEvaluation, SequenceSession } from "./types";

function defaultSessions(count: number, matiere: string): SequenceSession[] {
  return Array.from({ length: count }, (_, index) => ({
    sessionNumber: index + 1,
    title: `Séance ${index + 1} — ${matiere}`,
    objectif: "",
    dureeMinutes: 45,
    ordrePedagogique: index + 1,
    placeProgression: "",
  }));
}

export function buildIndependentSequenceDraft(
  input: IndependentSequenceCreateInput,
): SequenceDraft {
  const sessionCount = Math.max(1, input.sessionCount ?? input.sessions?.length ?? 3);
  const sessions: SequenceSession[] = input.sessions?.length
    ? input.sessions.map((session, index) => ({
        sessionNumber: index + 1,
        title: session.title,
        objectif: session.objectif ?? "",
        dureeMinutes: session.dureeMinutes ?? 45,
        ordrePedagogique: index + 1,
        placeProgression: "",
      }))
    : defaultSessions(sessionCount, input.matiere);

  const dureeEstimeeMinutes =
    input.dureeEstimeeMinutes ??
    sessions.reduce((sum, session) => sum + session.dureeMinutes, 0);

  const evaluations: SequenceEvaluation[] = [
    {
      evaluationType: "formative",
      label: "Évaluation formative",
      criteres: [],
    },
  ];

  return {
    title: input.title.trim(),
    matiere: input.matiere.trim(),
    sousMatiere: input.sousMatiere?.trim() ?? "",
    cycle: input.cycle?.trim() ?? "",
    niveau: input.niveau?.trim() ?? "",
    periodNumber: input.periodNumber ?? 1,
    weekNumbers: input.weekNumbers ?? [1],
    competenceBo: input.competenceBo?.trim() ?? "",
    attendus: input.attendus ?? [],
    objectifs: input.objectifs ?? [],
    dureeEstimeeMinutes,
    sessionCount: sessions.length,
    prerequis: input.prerequis ?? [],
    notions: input.notions ?? [],
    vocabulaire: [],
    materiel: input.materiel ?? [],
    resources: input.resources ?? [],
    methode: input.methode ?? "",
    evaluationFinale: { label: "", criteres: [] },
    differentiation: {
      elevesEnDifficulte: [],
      elevesAvances: [],
      groupes: [],
      adaptations: [],
    },
    prolongements: [],
    referentielIds: [],
    resourceIds: [],
    sessions,
    evaluations,
  };
}

export function resolveSequenceLinkMode(input: IndependentSequenceCreateInput): "linked" | "independent" {
  if (input.progressionId && input.progressionRowId) return "linked";
  return "independent";
}
