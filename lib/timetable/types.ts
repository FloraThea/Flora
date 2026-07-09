import type { SchoolLevel } from "@/lib/programming/types";

export const TIMETABLE_VARIANTS = [
  "classique",
  "piscine",
  "sorties",
  "evaluations",
] as const;
export type TimetableVariant = (typeof TIMETABLE_VARIANTS)[number];

export const SCHOOL_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"] as const;
export type SchoolDay = (typeof SCHOOL_DAYS)[number];

export const SLOT_TYPES = [
  "seance",
  "rituel",
  "recreation",
  "pause_meridienne",
  "decloisonnement",
  "apc",
  "eps",
  "intervenant",
  "sortie",
  "evaluation",
] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

export const LOCK_LEVELS = ["none", "session", "half_day", "full_day"] as const;
export type LockLevel = (typeof LOCK_LEVELS)[number];

export type RecessBlock = {
  after: string;
  durationMinutes: number;
  label: string;
};

export type TimetableConstraint = {
  id: string;
  type:
    | "no_subject_after"
    | "no_subject_before"
    | "fixed_day"
    | "avoid_consecutive"
    | "max_per_day";
  subject?: string;
  day?: string;
  value?: string;
  message: string;
};

export type RoomAvailability = {
  id: string;
  name: string;
  availableDays: string[];
  availableFrom: string;
  availableTo: string;
  subjects: string[];
};

export type IntervenantSlot = {
  id: string;
  name: string;
  subject: string;
  day: string;
  start: string;
  end: string;
  room?: string;
  locked: boolean;
};

export type DecloisonnementBlock = {
  id: string;
  label: string;
  subjects: string[];
  day?: string;
  durationMinutes: number;
};

export type ApcBlock = {
  id: string;
  label: string;
  subjects: string[];
  day?: string;
  start?: string;
  durationMinutes: number;
};

export type TimetableSettings = {
  schoolDays: string[];
  morningStart: string;
  morningEnd: string;
  afternoonStart: string;
  afternoonEnd: string;
  recesses: RecessBlock[];
  lunchBreak: { start: string; end: string };
  defaultSessionMinutes: number;
  maxSessionsPerDay: number;
  constraints: TimetableConstraint[];
  rooms: RoomAvailability[];
  intervenants: IntervenantSlot[];
  decloisonnements: DecloisonnementBlock[];
  apcSlots: ApcBlock[];
};

export type SmartTimetableSlot = {
  id: string;
  scheduleId: string;
  day: string;
  start: string;
  end: string;
  subject: string;
  subSubject: string;
  customText: string;
  color: string;
  gradient: string;
  slotType: SlotType;
  lockLevel: LockLevel;
  hours: number;
  room: string;
  intervenant: string;
  label: string;
  sortOrder: number;
  metadata: Record<string, unknown>;
};

export type TimetableSlotUpdateInput = {
  scheduleId: string;
  slotId: string;
  subject?: string;
  subSubject?: string;
  customText?: string;
  color?: string;
  gradient?: string;
  label?: string;
  room?: string;
  start?: string;
  end?: string;
};

export type StoredTimetableSchedule = {
  id: string;
  teacherProfileId: string | null;
  name: string;
  variantType: TimetableVariant;
  isActive: boolean;
  schoolYear: string;
  levels: SchoolLevel[];
  settings: TimetableSettings;
  weeklyHours: Record<string, number>;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TimetablePayload = {
  schedule: StoredTimetableSchedule;
  slots: SmartTimetableSlot[];
  validation: TimetableValidationResult;
};

export type TimetableConflict = {
  code: string;
  severity: "error" | "warning";
  message: string;
  slotIds: string[];
  day?: string;
};

export type TimetableValidationResult = {
  valid: boolean;
  conflicts: TimetableConflict[];
  weeklyHoursPlaced: Record<string, number>;
  weeklyHoursTarget: Record<string, number>;
};

export type TimetableVersion = {
  id: string;
  scheduleId: string;
  versionNumber: number;
  label: string;
  variantType: TimetableVariant;
  snapshot: TimetablePayload;
  created_at: string;
};

export type TimetableHistoryEntry = {
  id: string;
  scheduleId: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
};

export type TimetableGenerateInput = {
  scheduleId?: string;
  variantType?: TimetableVariant;
  preserveLocks?: boolean;
  settings?: Partial<TimetableSettings>;
};

export type TimetableMoveInput = {
  scheduleId: string;
  slotId: string;
  targetDay: string;
  targetStart: string;
  targetEnd: string;
};

export type TimetableLockInput = {
  scheduleId: string;
  scope: "session" | "half_day" | "full_day";
  day: string;
  slotId?: string;
  period?: "morning" | "afternoon";
  locked: boolean;
};

export const VARIANT_LABELS: Record<TimetableVariant, string> = {
  classique: "Semaine classique",
  piscine: "Semaine piscine",
  sorties: "Semaine sorties",
  evaluations: "Semaine évaluations",
};

export function createDefaultTimetableSettings(): TimetableSettings {
  return {
    schoolDays: [...SCHOOL_DAYS],
    morningStart: "08:30",
    morningEnd: "11:45",
    afternoonStart: "13:30",
    afternoonEnd: "16:30",
    recesses: [
      { after: "10:15", durationMinutes: 15, label: "Récréation" },
      { after: "15:15", durationMinutes: 15, label: "Récréation" },
    ],
    lunchBreak: { start: "11:45", end: "13:30" },
    defaultSessionMinutes: 60,
    maxSessionsPerDay: 6,
    constraints: [
      {
        id: "avoid-consecutive-fr",
        type: "avoid_consecutive",
        subject: "Français",
        message: "Éviter deux séances de Français consécutives.",
      },
      {
        id: "avoid-consecutive-maths",
        type: "avoid_consecutive",
        subject: "Mathématiques",
        message: "Éviter deux séances de Mathématiques consécutives.",
      },
    ],
    rooms: [
      {
        id: "salle-classe",
        name: "Salle de classe",
        availableDays: [...SCHOOL_DAYS],
        availableFrom: "08:30",
        availableTo: "16:30",
        subjects: [],
      },
      {
        id: "gymnase",
        name: "Gymnase",
        availableDays: ["Mardi", "Jeudi"],
        availableFrom: "13:30",
        availableTo: "16:30",
        subjects: ["EPS"],
      },
    ],
    intervenants: [],
    decloisonnements: [
      {
        id: "fr-arts",
        label: "Français / Arts plastiques",
        subjects: ["Français", "Arts plastiques"],
        durationMinutes: 120,
      },
    ],
    apcSlots: [
      {
        id: "apc-fr",
        label: "APC Français",
        subjects: ["Français"],
        durationMinutes: 60,
      },
    ],
  };
}
