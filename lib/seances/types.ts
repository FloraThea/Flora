import type { ProgressionRow } from "@/lib/progression/types";
import type { TeacherProfileBundle } from "@/lib/profile/types";
import type { ReferentielCompetence, ResourceContext, TimetableInput } from "@/lib/programming/types";
import type { SequencePayload, SequenceSession } from "@/lib/sequences/types";

export const LESSON_PHASES = [
  { key: "accueil", label: "Accueil", weight: 0.05 },
  { key: "rappel", label: "Rappel", weight: 0.08 },
  { key: "manipulation", label: "Manipulation", weight: 0.15 },
  { key: "recherche", label: "Recherche", weight: 0.12 },
  { key: "mise_en_commun", label: "Mise en commun", weight: 0.1 },
  { key: "institutionnalisation", label: "Institutionnalisation", weight: 0.12 },
  { key: "entrainement", label: "Entraînement", weight: 0.15 },
  { key: "reinvestissement", label: "Réinvestissement", weight: 0.1 },
  { key: "synthese", label: "Synthèse", weight: 0.08 },
  { key: "trace_ecrite", label: "Trace écrite", weight: 0.05 },
] as const;

export type LessonPhaseKey = (typeof LESSON_PHASES)[number]["key"];

export type SeanceMaterial = {
  guides: string[];
  albums: string[];
  affichages: string[];
  manipulation: string[];
  videoprojecteur: string[];
  photocopies: string[];
  fiches: string[];
  cartes: string[];
  jeux: string[];
  autres: string[];
};

export type SeanceDifferentiation = {
  elevesFragiles: string[];
  elevesAvances: string[];
  groupesBesoins: string[];
  adaptations: string[];
  variantes: string[];
};

export type SeanceEvaluation = {
  formative: string;
  criteresReussite: string[];
  observables: string[];
  remediations: string[];
};

export type SeanceHomework = {
  devoirs: string[];
  revisions: string[];
  lecture: string[];
  entrainement: string[];
};

export type SeanceTraceEcrite = {
  enseignant: string;
  eleve: string;
  lecon: string;
  aideMemoire: string;
};

export type SeanceActivity = {
  id?: string;
  phaseId?: string;
  sortOrder: number;
  objectif: string;
  consignesEnseignant: string;
  consignesEleves: string;
  organisation: string;
  dureeMinutes: number;
  variablesPedagogiques: string[];
  questions: string[];
  reponsesAttendues: string[];
  erreursFrequentes: string[];
  remediations: string[];
};

export type SeancePhase = {
  id?: string;
  phaseKey: LessonPhaseKey;
  title: string;
  sortOrder: number;
  dureeMinutes: number;
  summary: string;
  activities: SeanceActivity[];
};

export type SeanceDraft = {
  title: string;
  matiere: string;
  sousMatiere: string;
  niveau: string;
  cycle: string;
  periodNumber: number;
  weekNumber: number;
  sessionDate: string | null;
  dureeMinutes: number;
  competenceBo: string;
  objectif: string;
  prerequis: string[];
  methode: string;
  resourceIds: string[];
  referentielIds: string[];
  resources: string[];
  materiel: SeanceMaterial;
  differentiation: SeanceDifferentiation;
  evaluation: SeanceEvaluation;
  homework: SeanceHomework;
  traceEcrite: SeanceTraceEcrite;
  pedagogicalChoices: string[];
  phases: SeancePhase[];
};

export type StoredSeance = Omit<SeanceDraft, "phases"> & {
  id: string;
  sequenceSessionId: string;
  sequenceId: string;
  progressionId: string;
  progressionRowId: string;
  programmationId: string;
  teacherProfileId: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SeancePayload = {
  seance: StoredSeance;
  phases: SeancePhase[];
};

export type SeanceGenerationInput = {
  sequenceSessionId?: string;
  sequenceId?: string;
};

export type SeanceContext = {
  teacherProfile: TeacherProfileBundle;
  sequencePayload: SequencePayload;
  sequenceSession: SequenceSession;
  progressionRow: ProgressionRow;
  referentiel: ReferentielCompetence[];
  resources: ResourceContext[];
  timetable: TimetableInput;
  methode: string;
};

export type SeanceCardSummary = {
  id: string;
  title: string;
  matiere: string;
  sousMatiere: string;
  niveau: string;
  periodNumber: number;
  weekNumber: number;
  sessionDate: string | null;
  dureeMinutes: number;
  sequenceId: string;
  sequenceSessionId: string;
  sessionNumber: number;
  status: string;
};

export type SequenceSessionOption = {
  id: string;
  sequenceId: string;
  sequenceTitle: string;
  sessionNumber: number;
  title: string;
  objectif: string;
  dureeMinutes: number;
  matiere: string;
  sousMatiere: string;
  periodNumber: number;
  weekNumber: number;
  hasSeance: boolean;
  seanceId?: string;
};

export type SequenceWithSeancesSummary = {
  id: string;
  title: string;
  matiere: string;
  sousMatiere: string;
  sessionCount: number;
  seanceCount: number;
  periodNumber: number;
};

export type SeanceUpdateInput = {
  seanceId: string;
  entityType: "seance" | "phase" | "activity";
  entityId: string;
  field: string;
  value: unknown;
};

export type SeanceEditAction =
  | { type: "duplicate_activity"; seanceId: string; activityId: string }
  | { type: "move_activity"; seanceId: string; activityId: string; targetPhaseId: string; targetSortOrder: number }
  | { type: "merge_phases"; seanceId: string; sourcePhaseId: string; targetPhaseId: string }
  | { type: "split_phase"; seanceId: string; phaseId: string; activityIds: string[] };

export type SeanceViewMode = "list" | "cards" | "chrono" | "sequence" | "matiere" | "week";
