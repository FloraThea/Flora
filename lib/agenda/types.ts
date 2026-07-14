import type { FloraAccent } from "@/lib/theme";

export type AgendaView = "day" | "week" | "month" | "list" | "ma_journee" | "108h" | "tasks";

export type AgendaEventType =
  | "cours"
  | "seance"
  | "rituel"
  | "reunion"
  | "conseil_ecole"
  | "animation_pedagogique"
  | "apc"
  | "rdv_parents"
  | "ess"
  | "equipe_educative"
  | "sortie"
  | "intervenant"
  | "piscine"
  | "spectacle"
  | "evaluation"
  | "administratif"
  | "vacances"
  | "personnel";

export type AgendaEventCategory = "pedagogique" | "administratif" | "108h" | "personnel";

export type AgendaTaskStatus = "todo" | "in_progress" | "done";
export type AgendaTaskPriority = "low" | "medium" | "high";

export type ReminderOffset = "1w" | "1d" | "1h" | "15m";
export type ReminderTargetType = "event" | "task";
export type ReminderStatus = "pending" | "sent" | "dismissed";
export type ReminderChannel = "in_app" | "mobile";

export type AgendaEvent = {
  id: string;
  teacherProfileId: string | null;
  schoolYear: string;
  title: string;
  description: string;
  eventType: AgendaEventType;
  categoryCode: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location: string;
  color: FloraAccent;
  icon: string;
  sourceModule: string;
  sourceId: string;
  status: string;
  durationMinutes: number;
  auto108h: boolean;
  hours108EntryId: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AgendaTask = {
  id: string;
  teacherProfileId: string | null;
  title: string;
  description: string;
  priority: AgendaTaskPriority;
  dueDate: string | null;
  category: string;
  status: AgendaTaskStatus;
  eventId: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AgendaReminder = {
  id: string;
  teacherProfileId: string | null;
  targetType: ReminderTargetType;
  targetId: string;
  remindAt: string;
  offsetPreset: ReminderOffset;
  status: ReminderStatus;
  channel: ReminderChannel;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type Hours108Entry = {
  id: string;
  teacherProfileId: string | null;
  schoolYear: string;
  entryDate: string;
  categoryCode: string;
  durationMinutes: number;
  description: string;
  location: string;
  comments: string;
  attachmentUrl: string;
  sourceEventId: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type Hours108CategorySummary = {
  categoryCode: string;
  label: string;
  color: FloraAccent;
  plannedMinutes: number;
  completedMinutes: number;
  remainingMinutes: number;
  percentComplete: number;
  baseHoursAt100: number;
};

export type Hours108Dashboard = {
  schoolYear: string;
  workQuotaPercentage: number;
  workQuotaLabel: string;
  totalPlannedMinutes: number;
  totalCompletedMinutes: number;
  totalRemainingMinutes: number;
  percentComplete: number;
  categories: Hours108CategorySummary[];
  monthlyTrend: Array<{ month: string; minutes: number }>;
};

export type MaJourneePayload = {
  date: string;
  dateLabel: string;
  events: AgendaEvent[];
  tasks: AgendaTask[];
  reminders: AgendaReminder[];
  hours108: Hours108Dashboard;
  timetableSlots: Array<{
    start: string;
    end: string;
    subject: string;
    label: string;
  }>;
  seances: Array<{
    id: string;
    title: string;
    matiere: string;
    dureeMinutes: number;
    materiel?: string[];
  }>;
  documents: string[];
  priorities: string[];
};

export type AgendaFeedPayload = {
  events: AgendaEvent[];
  tasks: AgendaTask[];
  reminders: AgendaReminder[];
  dueReminders?: AgendaReminder[];
  syncedAt: string;
  needsSchoolYearSetup?: boolean;
};

export type CreateAgendaEventInput = {
  title: string;
  description?: string;
  eventType: AgendaEventType;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  location?: string;
  auto108h?: boolean;
  durationMinutes?: number;
};

export type CreateAgendaTaskInput = {
  title: string;
  description?: string;
  priority?: AgendaTaskPriority;
  dueDate?: string;
  category?: string;
  status?: AgendaTaskStatus;
};

export type CreateHours108EntryInput = {
  entryDate: string;
  categoryCode: string;
  durationMinutes: number;
  description?: string;
  location?: string;
  comments?: string;
  attachmentUrl?: string;
  sourceEventId?: string;
};
