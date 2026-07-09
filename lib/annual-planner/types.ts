import type { CalendarSnapshot, SchoolWeek } from "@/lib/programming/types";
import type { ProgressionPayload } from "@/lib/progression/types";
import type { ProgrammationPayload } from "@/lib/programming/types";
import type { FloraAccent } from "@/lib/theme";

export type PlannerViewMode =
  | "annual"
  | "period"
  | "month"
  | "project"
  | "subject"
  | "competencies"
  | "hours";

export type PlannerBadgeKind =
  | "project"
  | "sortie"
  | "evaluation"
  | "oeuvre"
  | "sequence"
  | "evenement"
  | "reunion"
  | "intervention"
  | "apc"
  | "hours108"
  | "subject"
  | "rituel";

export type PlannerBadge = {
  id: string;
  kind: PlannerBadgeKind;
  label: string;
  accent: FloraAccent;
  subjectKey?: string;
  href?: string;
  metadata?: Record<string, unknown>;
};

export type PlannerSessionIndicator = {
  id: string;
  label: string;
  subjectLabel: string;
  competenceBo: string;
  progressionRowId: string;
  href: string;
};

export type PlannerArtwork = {
  title: string;
  artist?: string;
  movement?: string;
  activity?: string;
  href?: string;
};

export type PlannerWeek = {
  id: string;
  weekNumberInYear: number;
  weekNumberInPeriod: number;
  periodNumber: number;
  periodLabel: string;
  periodAccent: FloraAccent;
  startDate: string;
  endDate: string;
  classDays: number;
  isPartial: boolean;
  publicHolidays: Array<{ date: string; label: string }>;
  badges: PlannerBadge[];
  sessions: PlannerSessionIndicator[];
  artwork?: PlannerArtwork;
  sequenceSpans: Array<{ id: string; label: string; weekCount: number; startWeek: number }>;
  loadScore: number;
  isPast: boolean;
  isCurrent: boolean;
};

export type PlannerVacationBlock = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  afterPeriodNumber: number;
};

export type PlannerTimelineMarker = {
  id: string;
  date: string;
  label: string;
  kind: "rentree" | "vacation" | "holiday" | "sortie" | "evaluation" | "project" | "conseil" | "fete";
  accent: FloraAccent;
};

export type PlannerStats = {
  weeksCompleted: number;
  weeksRemaining: number;
  hoursCompleted: number;
  hoursTarget: number;
  competencesValidated: number;
  competencesTotal: number;
  progressionsCompleted: number;
  sequencesInProgress: number;
  artworksStudied: number;
  sortiesCompleted: number;
  annualProgressPercent: number;
};

export type PlannerCompetenceStatus = {
  id: string;
  label: string;
  status: "done" | "remaining" | "missing";
  subjectLabel?: string;
};

export type PlannerSubjectHours = {
  subject: string;
  planned: number;
  target: number;
  delta: number;
  accent: FloraAccent;
};

export type PlannerSuggestion = {
  id: string;
  severity: "info" | "warning" | "alert";
  message: string;
};

export type PlannerAlert = {
  id: string;
  code: string;
  message: string;
  weekNumbers?: number[];
};

export type PlannerFilters = {
  view: PlannerViewMode;
  periodNumber?: number;
  month?: string;
  subject?: string;
  search?: string;
};

export type PlannerPayload = {
  calendar: CalendarSnapshot;
  weeks: PlannerWeek[];
  vacations: PlannerVacationBlock[];
  timeline: PlannerTimelineMarker[];
  stats: PlannerStats;
  competences: PlannerCompetenceStatus[];
  subjectHours: PlannerSubjectHours[];
  suggestions: PlannerSuggestion[];
  alerts: PlannerAlert[];
  programmationId?: string;
  progressionId?: string;
  profile: {
    prenom: string;
    levels: string[];
    schoolYear: string;
    zone: string;
  };
};

export type WeekMoveInput = {
  fromWeekNumberInYear: number;
  toWeekNumberInYear: number;
};

export type WeekMoveResult = {
  ok: boolean;
  updatedModules: string[];
  message: string;
};

export function findWeekByYearNumber(
  weeks: PlannerWeek[],
  weekNumberInYear: number,
): PlannerWeek | undefined {
  return weeks.find((week) => week.weekNumberInYear === weekNumberInYear);
}

export function findCalendarWeek(
  calendar: CalendarSnapshot,
  weekNumberInYear: number,
): SchoolWeek | undefined {
  return calendar.schoolWeeks.find((week) => week.weekNumberInYear === weekNumberInYear);
}
