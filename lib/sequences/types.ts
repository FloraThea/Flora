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
  progression_id: string | null;
  progression_row_id: string | null;
  programmation_id: string | null;
  progression_tab_id: string | null;
  link_mode?: "linked" | "independent";
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type IndependentSequenceCreateInput = {
  title: string;
  matiere: string;
  sousMatiere?: string;
  niveau?: string;
  cycle?: string;
  periodNumber?: number;
  weekNumbers?: number[];
  competenceBo?: string;
  objectifs?: string[];
  attendus?: string[];
  prerequis?: string[];
  notions?: string[];
  sessionCount?: number;
  dureeEstimeeMinutes?: number;
  methode?: string;
  materiel?: string[];
  resources?: string[];
  sessions?: Array<{
    title: string;
    objectif?: string;
    dureeMinutes?: number;
  }>;
  progressionId?: string | null;
  progressionRowId?: string | null;
  programmationId?: string | null;
};

export type SequenceLinkInput = {
  sequenceId: string;
  progressionId: string;
  progressionRowId: string;
  programmationId?: string | null;
  progressionTabId?: string | null;
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
