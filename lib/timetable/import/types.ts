import { enrichSlotFields, resolveSlotAppearance } from "../subject-palette";
import type { SlotType, SmartTimetableSlot, TimetablePayload } from "../types";

export type TimetableImportSession = {
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  title: string;
  subSubject?: string;
  customText?: string;
  level: string;
  group: string;
  location: string;
  notes: string;
  color: string;
  slotType: SlotType;
  rawLabel: string;
  isEmpty: boolean;
  rowIndex: number;
  colIndex: number;
};

export type SubjectMappingSuggestion = {
  sourceLabel: string;
  suggestedSubject: string;
  alternatives: string[];
  confidence: number;
  needsConfirmation: boolean;
};

export type EmptySlotSuggestion = {
  day: string;
  startTime: string;
  endTime: string;
  suggestions: string[];
};

export type TimetableLayout = "days_in_row" | "days_in_column";

export type TimetableStructure = {
  layout: TimetableLayout;
  headerRow: number;
  timeColumn: number;
  dayColumn: number;
  dayColumns: Record<string, number>;
  timeRows: Record<string, number>;
  confidence: number;
};

export type StructureOverrides = {
  layout?: TimetableLayout;
  headerRow?: number;
  timeColumn?: number;
  dayColumn?: number;
};

export type TimetableImportDiagnostics = {
  detectedDayRow: number | null;
  detectedDayColumn: number | null;
  detectedTimeColumn: number | null;
  detectedTimeRow: number | null;
  layout: TimetableLayout;
  mergedCellCount: number;
  detectedSubjects: string[];
  anomalies: string[];
  dayRowCandidates: Array<{ row: number; score: number; days: Record<string, number> }>;
  timeColumnCandidates: Array<{ col: number; score: number; sampleTimes: string[] }>;
  decorativeRows: number[];
};

export type ParsedTimetableImport = {
  fileName: string;
  sheetName: string;
  className: string;
  teacherName: string;
  schoolYear: string;
  days: string[];
  timeSlots: string[];
  sessions: TimetableImportSession[];
  emptySlots: EmptySlotSuggestion[];
  uncertainMappings: SubjectMappingSuggestion[];
  warnings: string[];
  structure: TimetableStructure;
  needsManualStructure: boolean;
  diagnostics: TimetableImportDiagnostics;
  gridPreview: string[][];
};

export type TimetableImportDraft = {
  id: string;
  schoolYear: string;
  className: string;
  teacherName: string;
  scheduleName: string;
  variantType: string;
  isPrimary: boolean;
  days: string[];
  timeSlots: string[];
  sessions: TimetableImportSession[];
};

export type TimetableImportSaveInput = {
  scheduleId?: string;
  scheduleName: string;
  variantType?: string;
  isPrimary?: boolean;
  schoolYear?: string;
  className?: string;
  teacherName?: string;
  sessions: TimetableImportSession[];
  confirmedMappings?: Record<string, string>;
  sourceFileName?: string;
};

export type TimetableImportSaveResult = TimetablePayload & {
  journalSynced: boolean;
};

export function importSessionToSlot(
  session: TimetableImportSession,
  scheduleId: string,
): SmartTimetableSlot {
  const start = session.startTime;
  const end = session.endTime;
  const durationMinutes = timeToMinutes(end) - timeToMinutes(start);
  const hours = Math.max(0.5, Math.round((durationMinutes / 60) * 2) / 2);
  const subSubject = session.subSubject || session.title || session.group;
  const customText = session.customText ?? session.notes ?? "";
  const appearance = resolveSlotAppearance({
    subject: session.subject,
    subSubject,
    slotType: session.slotType,
    color: session.color,
  });

  return enrichSlotFields({
    id: crypto.randomUUID(),
    scheduleId,
    day: session.day,
    start,
    end,
    subject: session.subject,
    subSubject,
    customText,
    color: appearance.color,
    gradient: appearance.gradient,
    slotType: session.slotType,
    lockLevel: "none",
    hours,
    room: session.location,
    intervenant: "",
    label: session.rawLabel || session.subject,
    sortOrder: 0,
    metadata: {
      level: session.level,
      group: session.group,
      notes: session.notes,
      color: appearance.color,
      importSource: session.rawLabel,
    },
  });
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
