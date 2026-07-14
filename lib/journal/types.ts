import type { CalendarSnapshot } from "@/lib/programming/types";
import type { TeacherProfileBundle } from "@/lib/profile/types";
import type { StoredSeance } from "@/lib/seances/types";

export const JOURNAL_VIEW_MODES = [
  "day",
  "week",
  "period",
  "calendar",
  "substitute",
  "print",
] as const;

export type JournalViewMode = (typeof JOURNAL_VIEW_MODES)[number];

export const OBSERVATION_STATUSES = [
  "realisee",
  "partielle",
  "non_realisee",
] as const;

export type ObservationStatus = (typeof OBSERVATION_STATUSES)[number];

export const ADJUSTMENT_STATUSES = ["pending", "accepted", "rejected"] as const;
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number];

export const EXPORT_FORMATS = ["html", "pdf", "word", "print"] as const;
export type JournalExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_VARIANTS = ["teacher", "substitute"] as const;
export type JournalExportVariant = (typeof EXPORT_VARIANTS)[number];

export type JournalEntryType = "slot" | "ritual" | "break" | "other";

export type JournalResources = {
  guides: string[];
  albums: string[];
  fiches: string[];
  documents: string[];
  jeux: string[];
  videos: string[];
  numeriques: string[];
  liens: string[];
};

export type JournalMateriel = {
  items: string[];
  guides: string[];
  albums: string[];
  fiches: string[];
  jeux: string[];
  autres: string[];
};

export type JournalObservation = {
  id?: string;
  journalEntryId: string;
  status: ObservationStatus;
  actualMinutes: number | null;
  comments: string;
  difficulties: string;
  successes: string;
  followUp: string;
};

export type JournalEntry = {
  id: string;
  journalId: string;
  sortOrder: number;
  entryType: JournalEntryType;
  startTime: string;
  endTime: string;
  matiere: string;
  seanceId: string | null;
  ritualId: string | null;
  ritualLabel: string;
  competence: string;
  objectif: string;
  dureeMinutes: number;
  organisation: string;
  materiel: JournalMateriel;
  documents: string[];
  resources: JournalResources;
  observations: string;
  observation?: JournalObservation | null;
  slotData: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type JournalDashboard = {
  plannedMinutes: number;
  actualMinutes: number;
  completedSessions: number;
  remainingSessions: number;
  completedRituals: number;
  workedCompetences: string[];
  remainingCompetences: string[];
  periodProgressPercent: number;
  annualProgressPercent: number;
};

export type StoredJournal = {
  id: string;
  teacherProfileId: string | null;
  schoolYear: string;
  journalDate: string;
  className: string;
  effectif: number;
  presents: number;
  absents: string[];
  dailyProject: string;
  mainObjectives: string[];
  importantInfo: string;
  remarks: string;
  periodNumber: number;
  weekNumber: number;
  status: string;
  dashboard: JournalDashboard;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type JournalPayload = {
  journal: StoredJournal;
  entries: JournalEntry[];
  adjustments: JournalAdjustment[];
  calendar: CalendarSnapshot | null;
  preview?: boolean;
  hasTimetable?: boolean;
  noClassDay?: boolean;
  specialDayMessage?: string;
};

export type JournalAdjustment = {
  id: string;
  journalId: string;
  proposedBy: string;
  adjustmentType: string;
  title: string;
  description: string;
  payload: Record<string, unknown>;
  status: AdjustmentStatus;
};

export type TimetableRefreshChange = {
  entryId: string;
  matiere: string;
  field: "startTime" | "endTime" | "matiere" | "subSubject";
  previousValue: string;
  nextValue: string;
};

export type TimetableRefreshPreview = {
  date: string;
  journalId: string | null;
  changes: TimetableRefreshChange[];
  preservedCount: number;
  updatableCount: number;
  message: string;
};

export type RitualDefinition = {
  id: string;
  label: string;
  matiere?: string;
  startTime?: string;
  endTime?: string;
  frequency: "daily" | "weekly";
  priority: number;
  objectif: string;
  organisation: string;
  dureeMinutes: number;
};

export type JournalGenerationInput = {
  date: string;
  teacherProfile: TeacherProfileBundle;
  calendar: CalendarSnapshot;
  regenerate?: boolean;
};

export type JournalAssemblyContext = {
  date: string;
  dayName: string;
  periodNumber: number;
  weekNumber: number;
  seances: StoredSeance[];
  rituals: RitualDefinition[];
  resourcesByMatiere: Record<string, JournalResources>;
};

export type CalendarSyncProvider = "google" | "outlook" | "apple";
export type CalendarSyncConfig = {
  enabled: boolean;
  provider: CalendarSyncProvider | null;
  lastSyncAt: string | null;
  metadata: Record<string, unknown>;
};

export type JournalRangePayload = {
  startDate: string;
  endDate: string;
  days: JournalDaySummary[];
};

export type JournalDaySummary = {
  date: string;
  journalId: string | null;
  status: string;
  entryCount: number;
  completedSessions: number;
  plannedMinutes: number;
  isHoliday: boolean;
};

export type JournalExportScope = "day" | "week" | "period";

export type JournalExportRecord = {
  id: string;
  journalId: string;
  exportFormat: JournalExportFormat;
  exportVariant: JournalExportVariant;
  content: string;
  created_at: string;
};
