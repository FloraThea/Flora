import type {
  ProgressionRow,
  ProgressionTab,
  StoredProgression,
} from "@/lib/progression/types";
import type { ReferentielCompetence, ResourceContext } from "@/lib/programming/types";

export type SequenceEvaluationType = "diagnostic" | "formative" | "summative";

export type SequenceEvaluation = {
  id?: string;
  evaluationType: SequenceEvaluationType;
  label: string;
  criteres: string[];
};

export type SequenceSession = {
  id?: string;
  sessionNumber: number;
  title: string;
  objectif: string;
  dureeMinutes: number;
  ordrePedagogique: number;
  placeProgression: string;
};

export type SequenceDifferentiation = {
  elevesEnDifficulte: string[];
  elevesAvances: string[];
  groupes: string[];
  adaptations: string[];
};

export type SequenceDraft = {
  title: string;
  matiere: string;
  sousMatiere: string;
  cycle: string;
  niveau: string;
  periodNumber: number;
  weekNumbers: number[];
  competenceBo: string;
  attendus: string[];
  objectifs: string[];
  dureeEstimeeMinutes: number;
  sessionCount: number;
  prerequis: string[];
  notions: string[];
  vocabulaire: string[];
  materiel: string[];
  resources: string[];
  methode: string;
  evaluationFinale: {
    label: string;
    criteres: string[];
  };
  differentiation: SequenceDifferentiation;
  prolongements: string[];
  referentielIds: string[];
  resourceIds: string[];
  sessions: SequenceSession[];
  evaluations: SequenceEvaluation[];
};

export type StoredSequence = Omit<SequenceDraft, "sessions" | "evaluations"> & {
  id: string;
  progression_id: string;
  progression_row_id: string;
  programmation_id: string;
  progression_tab_id: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SequenceGenerationInput = {
  progressionRowId: string;
};

export type SequenceContext = {
  progression: StoredProgression;
  tab: ProgressionTab;
  row: ProgressionRow;
  referentiel: ReferentielCompetence[];
  resources: ResourceContext[];
  methode: string;
  cycle: string;
  niveau: string;
  schoolYear: string;
};

export type SequencePayload = {
  sequence: StoredSequence;
  sessions: SequenceSession[];
  evaluations: SequenceEvaluation[];
};

export type ValidatedProgressionSummary = {
  id: string;
  title: string;
  methode: string;
  status: string;
  programmation_id: string;
  rowCount: number;
};

export type ProgressionRowSummary = {
  id: string;
  tabId: string;
  subjectLabel: string;
  subSubjectLabel: string;
  periodNumber: number;
  weekNumber: number;
  seanceLabel: string;
  competenceBo: string;
  sequenceModule: string;
  hasSequence: boolean;
};
