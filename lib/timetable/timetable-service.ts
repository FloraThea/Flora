import { supabase } from "@/lib/supabase";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import { enrichSlotFields, resolveSlotAppearance } from "./subject-palette";
import type { TimetableInput } from "@/lib/programming/types";
import type { RitualDefinition } from "@/lib/journal/types";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { getSchoolDaysFromWorkingDays } from "@/lib/profile/work-schedule";
import type { SchoolLevel } from "@/lib/programming/types";
import { dragDropEngine } from "./DragDropEngine";
import { timetableGenerator } from "./TimetableGenerator";
import { timetableValidator } from "./TimetableValidator";
import { lockManager } from "./LockManager";
import type {
  SmartTimetableSlot,
  StoredTimetableSchedule,
  TimetableGenerateInput,
  TimetableHistoryEntry,
  TimetableLockInput,
  TimetableMoveInput,
  TimetablePayload,
  TimetableSettings,
  TimetableSlotUpdateInput,
  TimetableVariant,
  TimetableVersion,
} from "./types";
import { createDefaultTimetableSettings as defaultSettings } from "./types";

function mapSchedule(row: Record<string, unknown>): StoredTimetableSchedule {
  return {
    id: String(row.id),
    teacherProfileId: row.teacher_profile_id ? String(row.teacher_profile_id) : null,
    name: String(row.name ?? ""),
    variantType: (String(row.variant_type ?? "classique") || "classique") as TimetableVariant,
    isActive: Boolean(row.is_active),
    schoolYear: String(row.school_year ?? ""),
    levels: (row.levels as SchoolLevel[]) ?? [],
    settings: {
      ...defaultSettings(),
      ...((row.settings as Partial<TimetableSettings>) ?? {}),
    },
    weeklyHours: (row.weekly_hours as Record<string, number>) ?? {},
    status: String(row.status ?? "draft"),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapSlot(row: Record<string, unknown>): SmartTimetableSlot {
  return enrichSlotFields({
    id: String(row.id),
    scheduleId: String(row.schedule_id),
    day: String(row.day ?? ""),
    start: String(row.start_time ?? ""),
    end: String(row.end_time ?? ""),
    subject: String(row.subject ?? ""),
    subSubject: String(row.sub_subject ?? ""),
    customText: String(row.custom_text ?? ""),
    color: String(row.color ?? ""),
    gradient: String(row.gradient ?? ""),
    slotType: row.slot_type as SmartTimetableSlot["slotType"],
    lockLevel: row.lock_level as SmartTimetableSlot["lockLevel"],
    hours: Number(row.hours ?? 1),
    room: String(row.room ?? ""),
    intervenant: String(row.intervenant ?? ""),
    label: String(row.label ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
  });
}

function mapVersion(row: Record<string, unknown>): TimetableVersion {
  return {
    id: String(row.id),
    scheduleId: String(row.schedule_id),
    versionNumber: Number(row.version_number ?? 1),
    label: String(row.label ?? ""),
    variantType: (String(row.variant_type ?? "classique") || "classique") as TimetableVariant,
    snapshot: row.snapshot as TimetablePayload,
    created_at: String(row.created_at ?? ""),
  };
}

function mapHistory(row: Record<string, unknown>): TimetableHistoryEntry {
  return {
    id: String(row.id),
    scheduleId: String(row.schedule_id),
    action: String(row.action ?? ""),
    details: (row.details as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ""),
  };
}

function slotsToTimetableInput(slots: SmartTimetableSlot[]): TimetableInput {
  return {
    slots: slots
      .filter((slot) => !["recreation", "pause_meridienne"].includes(slot.slotType))
      .map((slot) => ({
        day: slot.day,
        start: slot.start,
        end: slot.end,
        subject: slot.subject,
        hours: slot.hours,
      })),
    weeklyHoursBySubject: timetableValidator.computeWeeklyHours(slots),
  };
}

export async function loadScheduleSlots(scheduleId: string): Promise<SmartTimetableSlot[]> {
  const { data, error } = await supabase
    .from("timetable_slots")
    .select("*")
    .eq("schedule_id", scheduleId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapSlot);
}

export async function loadTimetablePayload(scheduleId: string): Promise<TimetablePayload | null> {
  const { data: scheduleRow, error } = await supabase
    .from("timetable_schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle();

  if (error || !scheduleRow) return null;

  const schedule = mapSchedule(scheduleRow);
  const slots = await loadScheduleSlots(scheduleId);
  const validation = timetableValidator.validate(
    slots,
    schedule.settings,
    schedule.levels,
    schedule.weeklyHours,
  );

  return { schedule, slots, validation };
}

export async function loadActiveSchedule(): Promise<TimetablePayload | null> {
  const { data, error } = await supabase
    .from("timetable_schedules")
    .select("*")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return loadTimetablePayload(String(data.id));
}

export async function listSchedules(): Promise<StoredTimetableSchedule[]> {
  const { data, error } = await supabase
    .from("timetable_schedules")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapSchedule);
}

async function appendHistory(
  scheduleId: string,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("timetable_history").insert({
    schedule_id: scheduleId,
    action,
    details,
  });
  if (error) throw error;
}

export async function ensureActiveSchedule(): Promise<TimetablePayload> {
  const existing = await loadActiveSchedule();
  if (existing) return existing;

  const bundle = await loadTeacherProfileBundle();
  const profile = bundle?.profile;
  const schoolDays = getSchoolDaysFromWorkingDays(profile?.workingDays ?? []);

  const { data, error } = await supabase
    .from("timetable_schedules")
    .insert({
      teacher_profile_id: profile?.id ?? null,
      name: "Emploi du temps principal",
      variant_type: "classique",
      is_active: true,
      school_year: profile?.schoolYear ?? "",
      levels: profile?.levels ?? [],
      settings: {
        ...defaultSettings(),
        schoolDays,
      },
      weekly_hours: {},
      status: "draft",
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error ?? new Error("Impossible de créer l'emploi du temps.");
  }

  await appendHistory(String(data.id), "create", { source: "ensureActiveSchedule" });

  const payload = await loadTimetablePayload(String(data.id));
  if (!payload) throw new Error("Emploi du temps introuvable après création.");
  return payload;
}

export async function saveScheduleSettings(
  scheduleId: string,
  settings: TimetableSettings,
  weeklyHours?: Record<string, number>,
): Promise<TimetablePayload> {
  const { error } = await supabase
    .from("timetable_schedules")
    .update({
      settings,
      weekly_hours: weeklyHours ?? {},
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  if (error) throw error;
  await appendHistory(scheduleId, "update_settings", { settings });

  const payload = await loadTimetablePayload(scheduleId);
  if (!payload) throw new Error("Emploi du temps introuvable.");
  return payload;
}

export async function replaceScheduleSlots(
  scheduleId: string,
  slots: SmartTimetableSlot[],
  action: string,
): Promise<TimetablePayload> {
  const { error: deleteError } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("schedule_id", scheduleId);

  if (deleteError) throw deleteError;

  if (slots.length > 0) {
    const { error: insertError } = await supabase.from("timetable_slots").insert(
      slots.map((slot, index) => ({
        id: slot.id,
        schedule_id: scheduleId,
        day: slot.day,
        start_time: slot.start,
        end_time: slot.end,
        subject: slot.subject,
        sub_subject: slot.subSubject,
        custom_text: slot.customText ?? "",
        color: slot.color ?? "",
        gradient: slot.gradient ?? "",
        slot_type: slot.slotType,
        lock_level: slot.lockLevel,
        hours: slot.hours,
        room: slot.room,
        intervenant: slot.intervenant,
        label: slot.label,
        sort_order: index,
        metadata: {
          ...slot.metadata,
          color: slot.color,
        },
      })),
    );
    if (insertError) throw insertError;
  }

  const weeklyHours = timetableValidator.computeWeeklyHours(slots);
  const { error: updateError } = await supabase
    .from("timetable_schedules")
    .update({
      weekly_hours: weeklyHours,
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  if (updateError) throw updateError;

  await appendHistory(scheduleId, action, { slotCount: slots.length });
  await syncScheduleToProfile(scheduleId, slots);

  const payload = await loadTimetablePayload(scheduleId);
  if (!payload) throw new Error("Emploi du temps introuvable.");
  return payload;
}

export async function syncScheduleToProfile(
  scheduleId: string,
  slots: SmartTimetableSlot[],
): Promise<void> {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) return;

  const timetable = slotsToTimetableInput(slots);
  const entryId = `edt-${scheduleId.slice(0, 8)}`;
  const timetables = bundle.profile.timetables.some((entry) => entry.id === entryId)
    ? bundle.profile.timetables.map((entry) =>
        entry.id === entryId ? { ...entry, timetable } : entry,
      )
    : [
        ...bundle.profile.timetables,
        { id: entryId, name: "Emploi du temps intelligent", timetable },
      ];

  const { error } = await supabase
    .from("teacher_profiles")
    .update({
      timetables,
      default_timetable_id: entryId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bundle.profile.id);

  if (error) throw error;
}

async function loadProgrammationWeeklyHours(): Promise<Record<string, number>[]> {
  const { data, error } = await supabase.from("programmations").select("timetable");
  if (error) throw error;

  return (data ?? []).map((row) => {
    const timetable = row.timetable as TimetableInput | null;
    return timetable?.weeklyHoursBySubject ?? {};
  });
}


export async function generateTimetable(input: TimetableGenerateInput): Promise<TimetablePayload> {
  const base = input.scheduleId
    ? await loadTimetablePayload(input.scheduleId)
    : await ensureActiveSchedule();

  if (!base) throw new Error("Emploi du temps introuvable.");

  const bundle = await loadTeacherProfileBundle();
  const ritualsRaw = bundle?.profile.metadata?.rituals;
  const rituals = Array.isArray(ritualsRaw) ? (ritualsRaw as RitualDefinition[]) : [];
  const profileSchoolDays = getSchoolDaysFromWorkingDays(bundle?.profile.workingDays ?? []);

  const context = timetableGenerator.buildContext({
    scheduleId: base.schedule.id,
    levels: base.schedule.levels.length > 0 ? base.schedule.levels : bundle?.profile.levels ?? [],
    schoolYear: base.schedule.schoolYear || bundle?.profile.schoolYear || "",
    settings: {
      ...base.schedule.settings,
      ...input.settings,
      schoolDays: input.settings?.schoolDays ?? profileSchoolDays.length > 0
        ? profileSchoolDays
        : base.schedule.settings.schoolDays,
    },
    weeklyHoursFromProgrammations: await loadProgrammationWeeklyHours(),
    rituals,
    existingSlots: base.slots,
    variantType: input.variantType ?? base.schedule.variantType,
  });

  const { slots, validation } = timetableGenerator.generate(context, input);

  if (input.variantType && input.variantType !== base.schedule.variantType) {
    await supabase
      .from("timetable_schedules")
      .update({ variant_type: input.variantType })
      .eq("id", base.schedule.id);
  }

  return replaceScheduleSlots(base.schedule.id, slots, "generate");
}

export async function moveTimetableSlot(input: TimetableMoveInput): Promise<TimetablePayload> {
  const payload = await loadTimetablePayload(input.scheduleId);
  if (!payload) throw new Error("Emploi du temps introuvable.");

  const result = dragDropEngine.moveSlot(
    input,
    payload.slots,
    payload.schedule.settings,
    payload.schedule.levels,
    payload.schedule.weeklyHours,
  );

  if (!result.moved) {
    return { ...payload, validation: result.validation };
  }

  const updated = await replaceScheduleSlots(input.scheduleId, result.slots, "move_slot");
  void pedagogicalEngine.emit({ type: "emploi_du_temps.modifie", scheduleId: input.scheduleId, scope: "slot" });
  return updated;
}

export async function updateTimetableSlot(input: TimetableSlotUpdateInput): Promise<TimetablePayload> {
  const payload = await loadTimetablePayload(input.scheduleId);
  if (!payload) throw new Error("Emploi du temps introuvable.");

  const current = payload.slots.find((slot) => slot.id === input.slotId);
  if (!current) throw new Error("Créneau introuvable.");

  const subject = input.subject ?? current.subject;
  const subSubject = input.subSubject ?? current.subSubject;
  const appearance = resolveSlotAppearance({
    subject,
    subSubject,
    slotType: current.slotType,
    color: input.color ?? current.color,
    gradient: input.gradient ?? current.gradient,
  });

  const { error } = await supabase
    .from("timetable_slots")
    .update({
      subject,
      sub_subject: subSubject,
      custom_text: input.customText ?? current.customText ?? "",
      color: appearance.color,
      gradient: appearance.gradient,
      label: input.label ?? current.label,
      room: input.room ?? current.room,
      start_time: input.start ?? current.start,
      end_time: input.end ?? current.end,
      updated_at: new Date().toISOString(),
      metadata: {
        ...current.metadata,
        color: appearance.color,
      },
    })
    .eq("id", input.slotId);

  if (error) throw error;

  await appendHistory(input.scheduleId, "update_slot", {
    slotId: input.slotId,
    subject,
    subSubject,
  });

  const updated = await loadTimetablePayload(input.scheduleId);
  if (!updated) throw new Error("Emploi du temps introuvable.");
  void pedagogicalEngine.emit({ type: "emploi_du_temps.modifie", scheduleId: input.scheduleId, scope: "slot" });
  return updated;
}

export async function applyTimetableLock(input: TimetableLockInput): Promise<TimetablePayload> {
  const payload = await loadTimetablePayload(input.scheduleId);
  if (!payload) throw new Error("Emploi du temps introuvable.");

  const slots = lockManager.applyLock(input, payload.slots, payload.schedule.settings);
  return replaceScheduleSlots(input.scheduleId, slots, input.locked ? "lock" : "unlock");
}

export async function createScheduleVersion(
  scheduleId: string,
  label: string,
): Promise<TimetableVersion> {
  const payload = await loadTimetablePayload(scheduleId);
  if (!payload) throw new Error("Emploi du temps introuvable.");

  const { data: existing } = await supabase
    .from("timetable_versions")
    .select("version_number")
    .eq("schedule_id", scheduleId)
    .order("version_number", { ascending: false })
    .limit(1);

  const versionNumber = (existing?.[0]?.version_number ?? 0) + 1;

  const { data, error } = await supabase
    .from("timetable_versions")
    .insert({
      schedule_id: scheduleId,
      version_number: versionNumber,
      label: label || `Version ${versionNumber}`,
      variant_type: payload.schedule.variantType,
      snapshot: payload,
    })
    .select("*")
    .single();

  if (error || !data) throw error ?? new Error("Impossible de créer la version.");

  await appendHistory(scheduleId, "create_version", { versionNumber, label });

  return mapVersion(data);
}

export async function listScheduleVersions(scheduleId: string): Promise<TimetableVersion[]> {
  const { data, error } = await supabase
    .from("timetable_versions")
    .select("*")
    .eq("schedule_id", scheduleId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapVersion);
}

export async function restoreScheduleVersion(versionId: string): Promise<TimetablePayload> {
  const { data, error } = await supabase
    .from("timetable_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();

  if (error || !data) throw error ?? new Error("Version introuvable.");

  const snapshot = data.snapshot as TimetablePayload;
  await supabase
    .from("timetable_schedules")
    .update({
      variant_type: snapshot.schedule.variantType,
      settings: snapshot.schedule.settings,
      weekly_hours: snapshot.schedule.weeklyHours,
      updated_at: new Date().toISOString(),
    })
    .eq("id", snapshot.schedule.id);

  return replaceScheduleSlots(snapshot.schedule.id, snapshot.slots, "restore_version");
}

export async function listScheduleHistory(scheduleId: string): Promise<TimetableHistoryEntry[]> {
  const { data, error } = await supabase
    .from("timetable_history")
    .select("*")
    .eq("schedule_id", scheduleId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []).map(mapHistory);
}

export async function activateScheduleVariant(
  scheduleId: string,
  variantType: TimetableVariant,
): Promise<TimetablePayload> {
  await supabase.from("timetable_schedules").update({ is_active: false }).eq("is_active", true);

  const { data, error } = await supabase
    .from("timetable_schedules")
    .insert({
      teacher_profile_id: (await loadTeacherProfileBundle())?.profile.id ?? null,
      name: `Emploi du temps — ${variantType}`,
      variant_type: variantType,
      is_active: true,
      school_year: (await loadActiveSchedule())?.schedule.schoolYear ?? "",
      levels: (await loadActiveSchedule())?.schedule.levels ?? [],
      settings: (await loadActiveSchedule())?.schedule.settings ?? defaultSettings(),
      weekly_hours: {},
      status: "draft",
    })
    .select("*")
    .single();

  if (error || !data) throw error ?? new Error("Impossible de créer la variante.");

  return generateTimetable({ scheduleId: String(data.id), variantType });
}
