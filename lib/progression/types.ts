import type { SourceDocument } from "@/lib/import/source-document";
import type { FloraAccent } from "@/lib/theme";
import type {
  CalendarSnapshot,
  ProgrammationPayload,
  ReferentielCompetence,
  ResourceContext,
  TimetableInput,
  ValidationIssue,
} from "@/lib/programming/types";

export type LearningItem = {
  id: string;
  type: "competence" | "notion" | "module" | "objectif";
  label: string;
  referentielId?: string;
  resourceIds?: string[];
  prerequisiteIds?: string[];
  order: number;
};

export type WeeklySlot = {
  periodNumber: number;
  weekNumber: number;
  sessionNumber: number;
  periodLabel: string;
  weekCount: number;
};

export type ProgressionRowDraft = {
  periodNumber: number;
  weekNumber: number;
  sessionNumber: number;
  sequenceModule: string;
  seanceLabel: string;
  competenceBo: string;
  objectifs: string[];
  deroulement: string;
  materiel: string[];
  resources: string[];
  remarques: string;
  commentaires: string;
  programmingTableId?: string;
  programmingPeriodId?: string;
  programmingCellId?: string;
  referentielIds: string[];
  resourceIds: string[];
  learningItemId?: string;
  metadata?: Record<string, unknown>;
};

export type ProgressionRow = ProgressionRowDraft & {
  id: string;
  sortOrder: number;
};

export type ProgressionTab = {
  id?: string;
  programmingTableId?: string;
  subjectKey: string;
  subjectLabel: string;
  subSubjectLabel: string;
  accent: FloraAccent;
  sortOrder: number;
  rows: ProgressionRow[];
};

export type ProgressionValidationSummary = {
  totalCompetences: number;
  coveredCompetences: number;
  duplicateCount: number;
  overloadedWeeks: number;
  prerequisiteViolations: number;
  balanceScore: number;
  completionRate: number;
};

export type ProgressionValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  summary: ProgressionValidationSummary;
};

export type ProgressionGenerationInput = {
  programmationId: string;
  methode: string;
};

export type ProgressionContext = {
  programmation: ProgrammationPayload;
  referentiel: ReferentielCompetence[];
  resources: ResourceContext[];
  calendar: CalendarSnapshot;
  timetable: TimetableInput;
  methode: string;
};

export type StoredProgression = {
  id: string;
  programmation_id: string | null;
  title: string;
  methode: string;
  status: string;
  link_mode?: "linked" | "independent";
  validation: ProgressionValidationResult;
  calendar_snapshot: CalendarSnapshot;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProgressionPayload = {
  progression: StoredProgression;
  tabs: ProgressionTab[];
  validation: ProgressionValidationResult;
  programmation: ProgrammationPayload["programmation"];
  sourceDocument?: SourceDocument | null;
  sourceType?: string;
};

export type ValidatedProgrammationSummary = {
  id: string;
  title: string;
  school_year: string;
  matiere: string;
  methode: string;
  levels: string[];
  status: string;
};

export type ProgressionDeleteMode = "progression_only" | "with_orphan_links";

export type ProgressionDependencies = {
  hasDependencies: boolean;
  programmation: { id: string; title: string } | null;
  sequences: number;
  seances: number;
  journalEntries: number;
  agendaEvents: number;
};
