import type { ParsedLessonSequence, ParsedLessonSession } from "@/lib/pedagogical/import/lesson-document-parser";
import type { SequenceDraft, SequenceEvaluation, SequenceSession } from "../types";

function mapSession(session: ParsedLessonSession, index: number): SequenceSession {
  return {
    sessionNumber: session.sessionNumber || index + 1,
    title: session.title.value || `Séance ${index + 1}`,
    objectif: session.objectif.value,
    dureeMinutes: session.dureeMinutes.value || 45,
    ordrePedagogique: index + 1,
    placeProgression: session.rawLine ?? "",
  };
}

export function mapParsedSequenceToDraft(
  sequence: ParsedLessonSequence,
  defaults?: {
    matiere?: string;
    sousMatiere?: string;
    niveau?: string;
    methode?: string;
  },
): SequenceDraft {
  const sessions = sequence.sessions.map(mapSession);
  const evaluations: SequenceEvaluation[] = sequence.evaluation.value
    ? [{ evaluationType: "formative", label: sequence.evaluation.value, criteres: [] }]
    : [{ evaluationType: "formative", label: "Évaluation formative", criteres: [] }];

  return {
    title: sequence.title.value || "Séquence importée",
    matiere: defaults?.matiere || sequence.matiere.value,
    sousMatiere: defaults?.sousMatiere || sequence.sousMatiere.value,
    cycle: "",
    niveau: defaults?.niveau || sequence.niveau.value,
    periodNumber: sequence.periodNumber.value ?? 1,
    weekNumbers: sequence.weekNumbers.value.length > 0 ? sequence.weekNumbers.value : [1],
    competenceBo: sequence.competences.value.join(", "),
    attendus: sequence.attendus.value,
    objectifs: sequence.objectifs.value,
    dureeEstimeeMinutes:
      sequence.dureeEstimeeMinutes.value ||
      sessions.reduce((sum, session) => sum + session.dureeMinutes, 0),
    sessionCount: sessions.length,
    prerequis: sequence.prerequis.value,
    notions: [],
    vocabulaire: [],
    materiel: sequence.materiel.value,
    resources: sequence.ressources.value,
    methode: defaults?.methode ?? "",
    evaluationFinale: {
      label: sequence.evaluation.value,
      criteres: [],
    },
    differentiation: {
      elevesEnDifficulte: sequence.differentiation.value ? [sequence.differentiation.value] : [],
      elevesAvances: [],
      groupes: [],
      adaptations: [],
    },
    prolongements: sequence.prolongements.value,
    referentielIds: [],
    resourceIds: [],
    sessions,
    evaluations,
  };
}

export function mapParsedImportToSequenceDrafts(
  sequences: ParsedLessonSequence[],
  defaults?: {
    matiere?: string;
    sousMatiere?: string;
    niveau?: string;
    methode?: string;
  },
): SequenceDraft[] {
  return sequences.map((sequence) => mapParsedSequenceToDraft(sequence, defaults));
}
