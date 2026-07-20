import type {
  ChangeLogEntry,
  CompetenceCoverage,
  HoursBalance,
  PedagogicalConflict,
  PedagogicalModule,
  PedagogicalStats,
} from "../types";

export type CoherenceIssue = PedagogicalConflict & {
  /** Pourquoi Flora signale ce point — IA explicable. */
  reason: string;
  /** Documents utilisés pour la détection. */
  sources: Array<{ module: PedagogicalModule; entityId?: string; label: string }>;
  /** Proposition de correction — jamais appliquée automatiquement. */
  proposal?: string;
};

export type BoCoverageReport = {
  covered: CompetenceCoverage[];
  partial: CompetenceCoverage[];
  missing: CompetenceCoverage[];
  duplicate: Array<CompetenceCoverage & { occurrences: number }>;
  coveragePercent: number;
  totalCompetences: number;
};

export type WeeklyPilotageWeek = {
  weekNumberInYear: number;
  periodNumber: number;
  startDate: string;
  endDate: string;
  subjects: string[];
  competences: string[];
  seanceCount: number;
  evaluationCount: number;
  projectCount: number;
  outingCount: number;
};

export type ExplainableSuggestion = {
  id: string;
  kind:
    | "remediation"
    | "revision"
    | "extra_session"
    | "differentiation"
    | "short_activity"
    | "reinvestment"
    | "evaluation"
    | "coherence";
  severity: "info" | "warning" | "alert";
  title: string;
  message: string;
  reason: string;
  sources: Array<{ module: PedagogicalModule; entityId?: string; label: string }>;
  competences: string[];
  /** L'utilisateur peut accepter, modifier ou ignorer — jamais appliqué automatiquement. */
  actionable: boolean;
};

export type DocumentChainNode = {
  module: PedagogicalModule | "sequence" | "ressources" | "cahier_journal";
  entityId: string;
  title: string;
  href: string;
  matiere?: string;
};

export type DocumentChain = {
  root: { module: string; entityId: string; title: string };
  chain: DocumentChainNode[];
};

export type PedagogicalSearchHit = {
  id: string;
  module: PedagogicalModule;
  title: string;
  snippet: string;
  matiere?: string;
  href: string;
  score: number;
};

export type PedagogicalSearchResult = {
  query: string;
  total: number;
  hits: PedagogicalSearchHit[];
  limit: number;
  offset: number;
};

export type ExtendedIndicators = PedagogicalStats & {
  seanceCount: number;
  sequenceCount: number;
  progressionCount: number;
  programmationCount: number;
  plannedHoursTotal: number;
  remainingHoursTotal: number;
  /** Semaines renseignées dans les progressions / total semaines travaillées. */
  plannedProgressPercent: number;
  byMatiere: Array<{ matiere: string; seances: number; progressions: number }>;
  byPeriod: Array<{ periodNumber: number; seanceCount: number; weekCount: number }>;
};

export type PilotagePayload = {
  generatedAt: string;
  schoolYear: string;
  coherence: { issues: CoherenceIssue[]; issueCount: number };
  coverage: BoCoverageReport;
  indicators: ExtendedIndicators;
  weeks: WeeklyPilotageWeek[];
  suggestions: ExplainableSuggestion[];
  recentHistory: ChangeLogEntry[];
  hours: HoursBalance[];
  matieres: string[];
};

export type PedagogicalExportFormat = "pdf" | "word" | "excel";

export type PedagogicalExportRequest = {
  format: PedagogicalExportFormat;
  scope: "matiere" | "year";
  matiere?: string;
};
