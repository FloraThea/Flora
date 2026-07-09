import { supabase } from "@/lib/supabase";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { resolveJournalTimetable } from "@/lib/journal/JournalTimetableResolver";
import { getFrenchDayName, normalizeDayName } from "@/lib/journal/date-utils";
import { ritualAssembler } from "@/lib/journal/RitualAssembler";
import type { CalendarSnapshot } from "@/lib/programming/types";
import type { TeacherProfileBundle } from "@/lib/profile/types";
import { getEventTypeDefinition } from "./event-types";

export type SyncContext = {
  bundle: TeacherProfileBundle;
  startDate: string;
  endDate: string;
};

function buildDateTime(isoDate: string, time: string): string {
  const normalized = time.length === 5 ? `${time}:00` : time;
  return `${isoDate}T${normalized}.000Z`;
}

function addMinutesToIso(isoStart: string, minutes: number): string {
  return new Date(new Date(isoStart).getTime() + minutes * 60_000).toISOString();
}

async function eventExists(
  profileId: string,
  sourceModule: string,
  sourceId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("agenda_events")
    .select("id")
    .eq("teacher_profile_id", profileId)
    .eq("source_module", sourceModule)
    .eq("source_id", sourceId)
    .maybeSingle();

  return Boolean(data);
}

async function insertSyncedEvent(input: {
  ctx: SyncContext;
  sourceModule: string;
  sourceId: string;
  title: string;
  description?: string;
  eventType: Parameters<typeof getEventTypeDefinition>[0];
  startAt: string;
  endAt: string;
  durationMinutes: number;
  metadata?: Record<string, unknown>;
  allDay?: boolean;
}): Promise<boolean> {
  if (await eventExists(input.ctx.bundle.profile.id, input.sourceModule, input.sourceId)) {
    return false;
  }

  const def = getEventTypeDefinition(input.eventType);
  const { error } = await supabase.from("agenda_events").insert({
    teacher_profile_id: input.ctx.bundle.profile.id,
    school_year: input.ctx.bundle.profile.schoolYear,
    title: input.title,
    description: input.description ?? "",
    event_type: input.eventType,
    category_code: input.eventType,
    start_at: input.startAt,
    end_at: input.endAt,
    all_day: input.allDay ?? false,
    duration_minutes: input.durationMinutes,
    color: def.color,
    icon: def.icon,
    source_module: input.sourceModule,
    source_id: input.sourceId,
    metadata: input.metadata ?? {},
    auto_108h: Boolean(def.auto108hCategory),
  });

  return !error;
}

function dateForPeriodWeek(
  calendar: CalendarSnapshot,
  periodNumber: number,
  weekNumber: number,
): string | null {
  const period = calendar.periods.find((item) => item.periodNumber === periodNumber);
  if (!period || weekNumber < 1) return null;

  const start = new Date(`${period.startDate}T12:00:00`);
  start.setDate(start.getDate() + (weekNumber - 1) * 7);
  const iso = start.toISOString().slice(0, 10);

  if (iso > period.endDate) return period.startDate;
  return iso;
}

export async function syncSeances(ctx: SyncContext): Promise<number> {
  let inserted = 0;

  const { data: seances } = await supabase
    .from("seances")
    .select("id, title, matiere, session_date, duree_minutes")
    .eq("teacher_profile_id", ctx.bundle.profile.id)
    .gte("session_date", ctx.startDate)
    .lte("session_date", ctx.endDate);

  for (const row of seances ?? []) {
    if (!row.session_date) continue;
    const date = String(row.session_date);
    const duration = Number(row.duree_minutes ?? 60);
    const startAt = buildDateTime(date, "08:30");

    const ok = await insertSyncedEvent({
      ctx,
      sourceModule: "seances",
      sourceId: `seance:${row.id}`,
      title: String(row.title ?? row.matiere ?? "Séance"),
      description: String(row.matiere ?? ""),
      eventType: "seance",
      startAt,
      endAt: addMinutesToIso(startAt, duration),
      durationMinutes: duration,
      metadata: { matiere: row.matiere, seanceId: row.id },
    });
    if (ok) inserted += 1;
  }

  return inserted;
}

export async function syncCahierJournal(ctx: SyncContext): Promise<number> {
  let inserted = 0;

  const { data: journals } = await supabase
    .from("journals")
    .select("id, journal_date")
    .eq("teacher_profile_id", ctx.bundle.profile.id)
    .gte("journal_date", ctx.startDate)
    .lte("journal_date", ctx.endDate);

  if (!journals?.length) return 0;

  const journalDates = new Map(journals.map((j) => [String(j.id), String(j.journal_date)]));
  const journalIds = journals.map((j) => j.id);

  const { data: entries } = await supabase
    .from("journal_entries")
    .select(
      "id, journal_id, entry_type, start_time, end_time, matiere, objectif, duree_minutes, seance_id, ritual_label, documents",
    )
    .in("journal_id", journalIds);

  for (const entry of entries ?? []) {
    const date = journalDates.get(String(entry.journal_id));
    if (!date) continue;

    const entryType = String(entry.entry_type ?? "slot");
    const isRitual = entryType === "ritual";
    const eventType = isRitual ? "rituel" : entry.seance_id ? "seance" : "cours";
    const startTime = String(entry.start_time ?? "08:30");
    const endTime = String(entry.end_time ?? "");
    const duration = Number(entry.duree_minutes ?? 60);
    const startAt = buildDateTime(date, startTime);
    const endAt = endTime ? buildDateTime(date, endTime) : addMinutesToIso(startAt, duration);

    const ok = await insertSyncedEvent({
      ctx,
      sourceModule: "cahier_journal",
      sourceId: `journal_entry:${entry.id}`,
      title: isRitual
        ? String(entry.ritual_label || "Rituel")
        : String(entry.matiere || entry.objectif || "Entrée cahier journal"),
      description: String(entry.objectif ?? ""),
      eventType,
      startAt,
      endAt,
      durationMinutes: duration,
      metadata: {
        journalEntryId: entry.id,
        seanceId: entry.seance_id,
        documents: entry.documents,
        entryType,
      },
    });
    if (ok) inserted += 1;
  }

  return inserted;
}

export async function syncRituels(ctx: SyncContext): Promise<number> {
  let inserted = 0;

  let timetable;
  try {
    timetable = await resolveJournalTimetable(ctx.bundle);
  } catch {
    return 0;
  }

  const start = new Date(`${ctx.startDate}T12:00:00`);
  const end = new Date(`${ctx.endDate}T12:00:00`);

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const iso = cursor.toISOString().slice(0, 10);
    const dayName = getFrenchDayName(iso);
    const daySlots = timetable.slots.filter(
      (slot) => normalizeDayName(slot.day) === normalizeDayName(dayName),
    );

    const rituals = ritualAssembler.buildRituals({
      profile: ctx.bundle,
      slots: daySlots,
      dayName,
    });

    for (const ritual of rituals) {
      const startTime = ritual.startTime ?? "08:30";
      const endTime =
        ritual.endTime ??
        (() => {
          const [h, m] = startTime.split(":").map(Number);
          const total = h * 60 + (m || 0) + ritual.dureeMinutes;
          return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
        })();

      const startAt = buildDateTime(iso, startTime);
      const endAt = buildDateTime(iso, endTime);

      const ok = await insertSyncedEvent({
        ctx,
        sourceModule: "rituels",
        sourceId: `rituel:${ritual.id}:${iso}`,
        title: ritual.label,
        description: ritual.objectif,
        eventType: "rituel",
        startAt,
        endAt,
        durationMinutes: ritual.dureeMinutes,
        metadata: {
          ritualId: ritual.id,
          matiere: ritual.matiere,
          organisation: ritual.organisation,
          frequency: ritual.frequency,
        },
      });
      if (ok) inserted += 1;
    }
  }

  return inserted;
}

export async function syncProgressions(ctx: SyncContext): Promise<number> {
  let inserted = 0;

  const { data: programmations } = await supabase
    .from("programmations")
    .select("id, title, school_year, calendar_snapshot")
    .eq("school_year", ctx.bundle.profile.schoolYear)
    .order("updated_at", { ascending: false })
    .limit(5);

  if (!programmations?.length) return 0;

  const calendar = (programmations[0].calendar_snapshot as CalendarSnapshot | null) ?? null;
  if (!calendar?.periods?.length) return 0;

  const programmationIds = programmations.map((p) => p.id);

  const { data: rows } = await supabase
    .from("progression_rows")
    .select(
      "id, seance_label, competence_bo, period_number, week_number, matiere, programmation_id, metadata",
    )
    .in("programmation_id", programmationIds)
    .gt("period_number", 0)
    .gt("week_number", 0);

  for (const row of rows ?? []) {
    const plannedDate = dateForPeriodWeek(
      calendar,
      Number(row.period_number),
      Number(row.week_number),
    );
    if (!plannedDate || plannedDate < ctx.startDate || plannedDate > ctx.endDate) continue;

    const label = String(row.seance_label || row.competence_bo || "Séance progression");
    const startAt = buildDateTime(plannedDate, "09:00");

    const ok = await insertSyncedEvent({
      ctx,
      sourceModule: "progressions",
      sourceId: `progression_row:${row.id}`,
      title: `P${row.period_number} S${row.week_number} — ${label}`,
      description: String(row.competence_bo ?? ""),
      eventType: "seance",
      startAt,
      endAt: addMinutesToIso(startAt, 60),
      durationMinutes: 60,
      metadata: {
        progressionRowId: row.id,
        programmationId: row.programmation_id,
        periodNumber: row.period_number,
        weekNumber: row.week_number,
      },
    });
    if (ok) inserted += 1;
  }

  return inserted;
}

export async function syncEmploiDuTemps(ctx: SyncContext): Promise<number> {
  let inserted = 0;

  try {
    const timetable = await resolveJournalTimetable(ctx.bundle);
    const start = new Date(`${ctx.startDate}T12:00:00`);
    const end = new Date(`${ctx.endDate}T12:00:00`);

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const iso = cursor.toISOString().slice(0, 10);
      const dayName = getFrenchDayName(iso);
      const slots = timetable.slots.filter(
        (slot) => normalizeDayName(slot.day) === normalizeDayName(dayName),
      );

      for (const slot of slots) {
        const startAt = buildDateTime(iso, slot.start);
        const endAt = buildDateTime(iso, slot.end);

        const ok = await insertSyncedEvent({
          ctx,
          sourceModule: "emploi_du_temps",
          sourceId: `edt:${iso}:${slot.start}:${slot.subject}`,
          title: slot.subject,
          description: "Emploi du temps",
          eventType: "cours",
          startAt,
          endAt,
          durationMinutes: Math.round((slot.hours ?? 1) * 60),
          metadata: { day: slot.day },
        });
        if (ok) inserted += 1;
      }
    }
  } catch {
    // EDT optionnel
  }

  return inserted;
}

export async function syncProjets(ctx: SyncContext): Promise<number> {
  let inserted = 0;

  for (const project of ctx.bundle.projects) {
    if (!project.title.trim()) continue;

    const eventType =
      project.projectType === "sortie"
        ? "sortie"
        : project.projectType === "intervenant"
          ? "intervenant"
          : "personnel";

    const ok = await insertSyncedEvent({
      ctx,
      sourceModule: "projets",
      sourceId: `project:${project.projectType}:${project.title}`,
      title: project.title,
      description: project.description,
      eventType,
      startAt: `${ctx.startDate}T00:00:00.000Z`,
      endAt: `${ctx.endDate}T23:59:59.999Z`,
      durationMinutes: 0,
      allDay: true,
      metadata: { projectType: project.projectType },
    });
    if (ok) inserted += 1;
  }

  return inserted;
}

export async function runAgendaSync(start: string, end: string): Promise<{
  inserted: number;
  breakdown: Record<string, number>;
}> {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) throw new Error("Profil enseignant requis.");

  const ctx: SyncContext = {
    bundle,
    startDate: start.slice(0, 10),
    endDate: end.slice(0, 10),
  };

  const breakdown = {
    seances: await syncSeances(ctx),
    cahier_journal: await syncCahierJournal(ctx),
    rituels: await syncRituels(ctx),
    progressions: await syncProgressions(ctx),
    emploi_du_temps: await syncEmploiDuTemps(ctx),
    projets: await syncProjets(ctx),
  };

  const inserted = Object.values(breakdown).reduce((sum, count) => sum + count, 0);
  return { inserted, breakdown };
}