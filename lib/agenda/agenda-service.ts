import { supabase } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { getOrCreateTeacherProfile, loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { resolveAgendaProfile, isMissingAgendaTableError, toAgendaUserMessage } from "./agenda-profile";
import { resolveJournalTimetable } from "@/lib/journal/JournalTimetableResolver";
import { getFrenchDayName, normalizeDayName } from "@/lib/journal/date-utils";
import { runAgendaSync } from "./agenda-sync";
import { getEventTypeDefinition } from "./event-types";
import type {
  AgendaEvent,
  AgendaFeedPayload,
  AgendaReminder,
  AgendaTask,
  CreateAgendaEventInput,
  CreateAgendaTaskInput,
  CreateHours108EntryInput,
  Hours108Dashboard,
  Hours108Entry,
  MaJourneePayload,
} from "./types";
import {
  computePlannedMinutesForCategory,
  computeTotalPlannedMinutes,
  formatMinutesAsHours,
  getCategoryColor,
  getCategoryLabel,
  HOURS_108_CATEGORIES,
} from "./hours-108";
import { REMINDER_OFFSETS } from "./event-types";
import type { FloraAccent } from "@/lib/theme";

function mapEvent(row: Record<string, unknown>): AgendaEvent {
  return {
    id: String(row.id),
    teacherProfileId: row.teacher_profile_id ? String(row.teacher_profile_id) : null,
    schoolYear: String(row.school_year ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    eventType: String(row.event_type ?? "personnel") as AgendaEvent["eventType"],
    categoryCode: String(row.category_code ?? "personnel"),
    startAt: String(row.start_at ?? ""),
    endAt: String(row.end_at ?? ""),
    allDay: Boolean(row.all_day),
    location: String(row.location ?? ""),
    color: (String(row.color ?? "lavender") || "lavender") as FloraAccent,
    icon: String(row.icon ?? "calendar"),
    sourceModule: String(row.source_module ?? "manual"),
    sourceId: String(row.source_id ?? ""),
    status: String(row.status ?? "confirmed"),
    durationMinutes: Number(row.duration_minutes ?? 60),
    auto108h: Boolean(row.auto_108h),
    hours108EntryId: row.hours_108_entry_id ? String(row.hours_108_entry_id) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapTask(row: Record<string, unknown>): AgendaTask {
  return {
    id: String(row.id),
    teacherProfileId: row.teacher_profile_id ? String(row.teacher_profile_id) : null,
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    priority: (String(row.priority ?? "medium") || "medium") as AgendaTask["priority"],
    dueDate: row.due_date ? String(row.due_date) : null,
    category: String(row.category ?? "general"),
    status: (String(row.status ?? "todo") || "todo") as AgendaTask["status"],
    eventId: row.event_id ? String(row.event_id) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapReminder(row: Record<string, unknown>): AgendaReminder {
  return {
    id: String(row.id),
    teacherProfileId: row.teacher_profile_id ? String(row.teacher_profile_id) : null,
    targetType: (String(row.target_type ?? "event") || "event") as AgendaReminder["targetType"],
    targetId: String(row.target_id ?? ""),
    remindAt: String(row.remind_at ?? ""),
    offsetPreset: (String(row.offset_preset ?? "1d") || "1d") as AgendaReminder["offsetPreset"],
    status: (String(row.status ?? "pending") || "pending") as AgendaReminder["status"],
    channel: (String(row.channel ?? "in_app") || "in_app") as AgendaReminder["channel"],
    message: String(row.message ?? ""),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ""),
  };
}

function mapHoursEntry(row: Record<string, unknown>): Hours108Entry {
  return {
    id: String(row.id),
    teacherProfileId: row.teacher_profile_id ? String(row.teacher_profile_id) : null,
    schoolYear: String(row.school_year ?? ""),
    entryDate: String(row.entry_date ?? ""),
    categoryCode: String(row.category_code ?? ""),
    durationMinutes: Number(row.duration_minutes ?? 0),
    description: String(row.description ?? ""),
    location: String(row.location ?? ""),
    comments: String(row.comments ?? ""),
    attachmentUrl: String(row.attachment_url ?? ""),
    sourceEventId: row.source_event_id ? String(row.source_event_id) : null,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

async function getProfileContext() {
  const ctx = await resolveAgendaProfile();
  if (!ctx) throw new Error("Profil enseignant requis.");
  return ctx.bundle;
}

export async function listAgendaEvents(input: {
  start: string;
  end: string;
  teacherProfileId?: string;
}): Promise<AgendaEvent[]> {
  const bundle = await getProfileContext();
  const profileId = input.teacherProfileId ?? bundle.profile.id;

  const { data, error } = await supabase
    .from("agenda_events")
    .select("*")
    .eq("teacher_profile_id", profileId)
    .gte("start_at", input.start)
    .lte("start_at", input.end)
    .order("start_at", { ascending: true });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de charger les événements."));
  }

  return (data ?? []).map(mapEvent);
}

export async function createAgendaEvent(input: CreateAgendaEventInput): Promise<AgendaEvent> {
  const bundle = await getProfileContext();
  const def = getEventTypeDefinition(input.eventType);

  const { data, error } = await supabase
    .from("agenda_events")
    .insert({
      teacher_profile_id: bundle.profile.id,
      school_year: bundle.profile.schoolYear,
      title: input.title,
      description: input.description ?? "",
      event_type: input.eventType,
      category_code: input.eventType,
      start_at: input.startAt,
      end_at: input.endAt,
      all_day: input.allDay ?? false,
      location: input.location ?? "",
      color: def.color,
      icon: def.icon,
      source_module: "manual",
      source_id: "",
      duration_minutes: input.durationMinutes ?? def.defaultDurationMinutes,
      auto_108h: input.auto108h ?? Boolean(def.auto108hCategory),
      metadata: {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de créer l'événement."));
  }

  const event = mapEvent(data);

  if (event.auto108h && def.auto108hCategory) {
    await createHours108EntryFromEvent(event, def.auto108hCategory);
  }

  await createDefaultReminders(event);

  return event;
}

export async function deleteAgendaEvent(eventId: string): Promise<void> {
  const bundle = await getProfileContext();
  const { error } = await supabase
    .from("agenda_events")
    .delete()
    .eq("id", eventId)
    .eq("teacher_profile_id", bundle.profile.id);
  if (error) throw new Error(getSupabaseErrorMessage(error, "Suppression impossible."));
}

export async function moveAgendaEvent(eventId: string, targetDate: string): Promise<AgendaEvent> {
  const bundle = await getProfileContext();
  const { data: row, error: fetchError } = await supabase
    .from("agenda_events")
    .select("*")
    .eq("id", eventId)
    .eq("teacher_profile_id", bundle.profile.id)
    .single();

  if (fetchError || !row) {
    throw new Error("Événement introuvable.");
  }

  const event = mapEvent(row);
  const oldDate = event.startAt.slice(0, 10);
  if (oldDate === targetDate) return event;

  const startTime = event.startAt.slice(11, 19);
  const endTime = event.endAt.slice(11, 19);
  const newStartAt = `${targetDate}T${startTime}.000Z`;
  const newEndAt = `${targetDate}T${endTime}.000Z`;

  const { data, error } = await supabase
    .from("agenda_events")
    .update({
      start_at: newStartAt,
      end_at: newEndAt,
      updated_at: new Date().toISOString(),
      metadata: {
        ...event.metadata,
        movedFrom: oldDate,
        movedAt: new Date().toISOString(),
      },
    })
    .eq("id", eventId)
    .eq("teacher_profile_id", bundle.profile.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Déplacement impossible."));
  }

  return mapEvent(data);
}

export async function markReminderSent(reminderId: string): Promise<void> {
  await supabase.from("agenda_reminders").update({ status: "sent" }).eq("id", reminderId);
}

export async function listAgendaTasks(teacherProfileId?: string): Promise<AgendaTask[]> {
  const bundle = await getProfileContext();
  const profileId = teacherProfileId ?? bundle.profile.id;

  const { data, error } = await supabase
    .from("agenda_tasks")
    .select("*")
    .eq("teacher_profile_id", profileId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (error) throw new Error(getSupabaseErrorMessage(error, "Impossible de charger les tâches."));
  return (data ?? []).map(mapTask);
}

export async function createAgendaTask(input: CreateAgendaTaskInput): Promise<AgendaTask> {
  const bundle = await getProfileContext();

  const { data, error } = await supabase
    .from("agenda_tasks")
    .insert({
      teacher_profile_id: bundle.profile.id,
      title: input.title,
      description: input.description ?? "",
      priority: input.priority ?? "medium",
      due_date: input.dueDate ?? null,
      category: input.category ?? "general",
      status: input.status ?? "todo",
      metadata: {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de créer la tâche."));
  }

  return mapTask(data);
}

export async function updateAgendaTask(
  taskId: string,
  patch: Partial<CreateAgendaTaskInput & { status: AgendaTask["status"]; eventId?: string | null }>,
): Promise<AgendaTask> {
  const bundle = await getProfileContext();
  const { data, error } = await supabase
    .from("agenda_tasks")
    .update({
      title: patch.title,
      description: patch.description,
      priority: patch.priority,
      due_date: patch.dueDate,
      category: patch.category,
      status: patch.status,
      event_id: patch.eventId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("teacher_profile_id", bundle.profile.id)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Mise à jour impossible."));
  }

  return mapTask(data);
}

export async function convertTaskToEvent(taskId: string): Promise<AgendaEvent> {
  const bundle = await getProfileContext();
  const { data: taskRow, error } = await supabase
    .from("agenda_tasks")
    .select("*")
    .eq("id", taskId)
    .eq("teacher_profile_id", bundle.profile.id)
    .single();

  if (error || !taskRow) {
    throw new Error("Tâche introuvable.");
  }

  const task = mapTask(taskRow);
  const startDate = task.dueDate ?? new Date().toISOString().slice(0, 10);
  const startAt = `${startDate}T09:00:00.000Z`;
  const endAt = `${startDate}T10:00:00.000Z`;

  const event = await createAgendaEvent({
    title: task.title,
    description: task.description,
    eventType: "personnel",
    startAt,
    endAt,
    durationMinutes: 60,
  });

  await updateAgendaTask(taskId, { status: "done", eventId: event.id });
  return event;
}

async function createDefaultReminders(event: AgendaEvent): Promise<void> {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) return;

  const startMs = new Date(event.startAt).getTime();
  const rows = REMINDER_OFFSETS.map((offset) => ({
    teacher_profile_id: bundle.profile.id,
    target_type: "event" as const,
    target_id: event.id,
    remind_at: new Date(startMs - offset.minutes * 60 * 1000).toISOString(),
    offset_preset: offset.value,
    status: "pending",
    channel: "in_app",
    message: `${offset.label} : ${event.title}`,
    metadata: { eventTitle: event.title },
  }));

  await supabase.from("agenda_reminders").insert(rows);
}

export async function listPendingReminders(teacherProfileId?: string): Promise<AgendaReminder[]> {
  const bundle = await getProfileContext();
  const profileId = teacherProfileId ?? bundle.profile.id;
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("agenda_reminders")
    .select("*")
    .eq("teacher_profile_id", profileId)
    .eq("status", "pending")
    .lte("remind_at", now)
    .order("remind_at", { ascending: true });

  if (error) return [];
  return (data ?? []).map(mapReminder);
}

export async function listUpcomingReminders(
  limit = 10,
  teacherProfileId?: string,
): Promise<AgendaReminder[]> {
  const bundle = await getProfileContext();
  const profileId = teacherProfileId ?? bundle.profile.id;
  const now = new Date().toISOString();

  const { data } = await supabase
    .from("agenda_reminders")
    .select("*")
    .eq("teacher_profile_id", profileId)
    .eq("status", "pending")
    .gte("remind_at", now)
    .order("remind_at", { ascending: true })
    .limit(limit);

  return (data ?? []).map(mapReminder);
}

export async function createHours108Entry(input: CreateHours108EntryInput): Promise<Hours108Entry> {
  const bundle = await getProfileContext();

  const { data, error } = await supabase
    .from("teacher_108h_entries")
    .insert({
      teacher_profile_id: bundle.profile.id,
      school_year: bundle.profile.schoolYear,
      entry_date: input.entryDate,
      category_code: input.categoryCode,
      duration_minutes: input.durationMinutes,
      description: input.description ?? "",
      location: input.location ?? "",
      comments: input.comments ?? "",
      attachment_url: input.attachmentUrl ?? "",
      source_event_id: input.sourceEventId ?? null,
      metadata: {},
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible d'enregistrer l'activité 108h."));
  }

  await refreshHours108Summary(bundle.profile.id, bundle.profile.schoolYear, bundle.profile.workQuotaPercentage);
  return mapHoursEntry(data);
}

async function createHours108EntryFromEvent(event: AgendaEvent, categoryCode: string): Promise<void> {
  const entry = await createHours108Entry({
    entryDate: event.startAt.slice(0, 10),
    categoryCode,
    durationMinutes: event.durationMinutes,
    description: event.title,
    location: event.location,
    sourceEventId: event.id,
  });

  await supabase
    .from("agenda_events")
    .update({ hours_108_entry_id: entry.id, updated_at: new Date().toISOString() })
    .eq("id", event.id);
}

export async function refreshHours108Summary(
  teacherProfileId: string,
  schoolYear: string,
  workQuotaPercentage: number,
): Promise<void> {
  const { data: entries } = await supabase
    .from("teacher_108h_entries")
    .select("category_code, duration_minutes")
    .eq("teacher_profile_id", teacherProfileId)
    .eq("school_year", schoolYear);

  const completedByCategory = new Map<string, number>();
  for (const row of entries ?? []) {
    const code = String(row.category_code);
    completedByCategory.set(code, (completedByCategory.get(code) ?? 0) + Number(row.duration_minutes ?? 0));
  }

  for (const category of HOURS_108_CATEGORIES) {
    const planned = computePlannedMinutesForCategory(category.code, workQuotaPercentage);
    const completed = completedByCategory.get(category.code) ?? 0;

    await supabase.from("teacher_108h_summary").upsert(
      {
        teacher_profile_id: teacherProfileId,
        school_year: schoolYear,
        category_code: category.code,
        planned_minutes: planned,
        completed_minutes: completed,
        work_quota_percentage: workQuotaPercentage,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "teacher_profile_id,school_year,category_code" },
    );
  }
}

export async function getHours108Dashboard(): Promise<Hours108Dashboard> {
  const bundle = await getProfileContext();
  await refreshHours108Summary(
    bundle.profile.id,
    bundle.profile.schoolYear,
    bundle.profile.workQuotaPercentage,
  );

  const { data: entries } = await supabase
    .from("teacher_108h_entries")
    .select("entry_date, category_code, duration_minutes")
    .eq("teacher_profile_id", bundle.profile.id)
    .eq("school_year", bundle.profile.schoolYear);

  const monthly = new Map<string, number>();
  for (const row of entries ?? []) {
    const month = String(row.entry_date).slice(0, 7);
    monthly.set(month, (monthly.get(month) ?? 0) + Number(row.duration_minutes ?? 0));
  }

  const categories = HOURS_108_CATEGORIES.map((category) => {
    const planned = computePlannedMinutesForCategory(category.code, bundle.profile.workQuotaPercentage);
    const completedMinutes = (entries ?? [])
      .filter((row) => String(row.category_code) === category.code)
      .reduce((sum, row) => sum + Number(row.duration_minutes ?? 0), 0);

    const remaining = Math.max(0, planned - completedMinutes);
    const percentComplete = planned > 0 ? Math.round((completedMinutes / planned) * 100) : 0;

    return {
      categoryCode: category.code,
      label: category.label,
      color: category.color,
      plannedMinutes: planned,
      completedMinutes,
      remainingMinutes: remaining,
      percentComplete,
      baseHoursAt100: category.baseHoursAt100,
    };
  });

  const totalPlanned = computeTotalPlannedMinutes(bundle.profile.workQuotaPercentage);
  const totalCompleted = categories.reduce((sum, item) => sum + item.completedMinutes, 0);

  return {
    schoolYear: bundle.profile.schoolYear,
    workQuotaPercentage: bundle.profile.workQuotaPercentage,
    workQuotaLabel: bundle.profile.workQuotaLabel,
    totalPlannedMinutes: totalPlanned,
    totalCompletedMinutes: totalCompleted,
    totalRemainingMinutes: Math.max(0, totalPlanned - totalCompleted),
    percentComplete: totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0,
    categories,
    monthlyTrend: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, minutes]) => ({ month, minutes })),
  };
}

export async function syncAgendaFromModules(start: string, end: string): Promise<number> {
  const result = await runAgendaSync(start, end);
  return result.inserted;
}

export async function loadAgendaFeed(start: string, end: string): Promise<AgendaFeedPayload> {
  const profileCtx = await resolveAgendaProfile();

  if (!profileCtx) {
    return {
      events: [],
      tasks: [],
      reminders: [],
      dueReminders: [],
      syncedAt: new Date().toISOString(),
      needsSchoolYearSetup: true,
    };
  }

  try {
    await syncAgendaFromModules(start, end);
  } catch (error) {
    if (!isMissingAgendaTableError(error)) {
      console.error("[agenda] Synchronisation ignorée :", error);
    }
  }

  const profileId = profileCtx.bundle.profile.id;

  try {
    const [events, tasks, reminders, dueReminders] = await Promise.all([
      listAgendaEvents({ start, end, teacherProfileId: profileId }),
      listAgendaTasks(profileId),
      listUpcomingReminders(20, profileId),
      listPendingReminders(profileId),
    ]);

    return {
      events,
      tasks,
      reminders,
      dueReminders,
      syncedAt: new Date().toISOString(),
      needsSchoolYearSetup: profileCtx.needsSchoolYearSetup,
    };
  } catch (error) {
    throw new Error(toAgendaUserMessage(error));
  }
}

export async function buildMaJournee(date: string): Promise<MaJourneePayload> {
  const bundle = await getProfileContext();
  const dayStart = `${date}T00:00:00.000Z`;
  const dayEnd = `${date}T23:59:59.999Z`;

  await syncAgendaFromModules(dayStart, dayEnd);

  const [events, tasks, reminders, hours108] = await Promise.all([
    listAgendaEvents({ start: dayStart, end: dayEnd }),
    listAgendaTasks(),
    listUpcomingReminders(8),
    getHours108Dashboard(),
  ]);

  const dayTasks = tasks.filter(
    (task) => task.dueDate === date || (task.status !== "done" && !task.dueDate),
  );

  let timetableSlots: MaJourneePayload["timetableSlots"] = [];
  try {
    const timetable = await resolveJournalTimetable(bundle);
    const dayName = getFrenchDayName(date);
    timetableSlots = timetable.slots
      .filter((slot) => normalizeDayName(slot.day) === normalizeDayName(dayName))
      .map((slot) => ({
        start: slot.start,
        end: slot.end,
        subject: slot.subject,
        label: slot.subject,
      }));
  } catch {
    timetableSlots = [];
  }

  const { data: seanceRows } = await supabase
    .from("seances")
    .select("id, title, matiere, duree_minutes, materiel")
    .eq("teacher_profile_id", bundle.profile.id)
    .eq("session_date", date);

  const seances = (seanceRows ?? []).map((row) => ({
    id: String(row.id),
    title: String(row.title ?? ""),
    matiere: String(row.matiere ?? ""),
    dureeMinutes: Number(row.duree_minutes ?? 60),
    materiel: Array.isArray(row.materiel)
      ? (row.materiel as string[])
      : undefined,
  }));

  const documents = events
    .flatMap((event) => (event.metadata.documents as string[] | undefined) ?? [])
    .filter(Boolean);

  const priorities = [
    ...dayTasks.filter((task) => task.priority === "high").map((task) => task.title),
    ...events.slice(0, 3).map((event) => event.title),
  ].slice(0, 5);

  return {
    date,
    dateLabel: new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    events,
    tasks: dayTasks,
    reminders,
    hours108,
    timetableSlots,
    seances,
    documents,
    priorities,
  };
}

export { formatMinutesAsHours, getCategoryLabel, getCategoryColor };
