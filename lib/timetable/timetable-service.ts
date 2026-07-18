import { floraDb } from "@/lib/supabase/get-db";
import { pedagogicalEngine } from "@/lib/pedagogical/PedagogicalEngine";
import {
  createBlankSlot,
  detectSlotConflicts,
  duplicateSlot,
  insertSlotAfter,
  mergeSlotMeta,
  mergeTwoSlots,
  moveSlotWithinDay,
  readSlotMeta,
  removeSlot,
  shiftFollowingSlotsOnDay,
  splitSlotAt,
  durationMinutes,
} from "./slot-editor/operations";
import type { SlotEditorMetadata } from "./slot-editor/operations";
import { enrichSlotFields, resolveSlotAppearance } from "./subject-palette";
import { hoursFromSlot, sortSlots } from "./time-grid";
import { inferSlotType } from "./import/subject-mapper";
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
  TimetableSlotActionInput,
  TimetableSlotUpdateInput,
  TimetableActionPayload,
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
  const metadata = (row.metadata as Record<string, unknown>) ?? {};
  return enrichSlotFields({
    id: String(row.id),
    scheduleId: String(row.schedule_id),
    day: String(row.day ?? ""),
    start: String(row.start_time ?? ""),
    end: String(row.end_time ?? ""),
    subject: String(row.subject ?? ""),
    subSubject: String(row.sub_subject ?? ""),
    customText: String(row.custom_text ?? metadata.customText ?? ""),
    color: String(row.color ?? metadata.color ?? ""),
    gradient: String(row.gradient ?? metadata.gradient ?? ""),
    slotType: row.slot_type as SmartTimetableSlot["slotType"],
    lockLevel: row.lock_level as SmartTimetableSlot["lockLevel"],
    hours: Number(row.hours ?? 1),
    room: String(row.room ?? ""),
    intervenant: String(row.intervenant ?? ""),
    label: String(row.label ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
    metadata,
  });
}

function buildSlotMetadata(slot: SmartTimetableSlot): Record<string, unknown> {
  return {
    ...slot.metadata,
    ...(slot.color ? { color: slot.color } : {}),
    ...(slot.gradient ? { gradient: slot.gradient } : {}),
    ...(slot.customText ? { customText: slot.customText } : {}),
  };
}

function buildSlotInsertRow(
  slot: SmartTimetableSlot,
  scheduleId: string,
  index: number,
  includeDisplayColumns: boolean,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: slot.id,
    schedule_id: scheduleId,
    day: slot.day,
    start_time: slot.start,
    end_time: slot.end,
    subject: slot.subject,
    sub_subject: slot.subSubject,
    slot_type: slot.slotType,
    lock_level: slot.lockLevel,
    hours: slot.hours,
    room: slot.room ?? "",
    intervenant: slot.intervenant ?? "",
    label: slot.label ?? slot.subject,
    sort_order: index,
    metadata: buildSlotMetadata(slot),
  };

  if (includeDisplayColumns) {
    row.custom_text = slot.customText ?? "";
    row.color = slot.color ?? "";
    row.gradient = slot.gradient ?? "";
  }

  return row;
}

function isMissingDisplayColumnError(error: { message?: string } | null): boolean {
  if (!error?.message) return false;
  return /Could not find the '(color|gradient|custom_text)' column/.test(error.message);
}

async function upsertScheduleSlotRows(
  scheduleId: string,
  slots: SmartTimetableSlot[],
): Promise<void> {
  if (slots.length === 0) return;

  let rows = slots.map((slot, index) =>
    buildSlotInsertRow(slot, scheduleId, index, true),
  );

  let { error } = await (await floraDb()).from("timetable_slots").upsert(rows, { onConflict: "id" });

  if (error && isMissingDisplayColumnError(error)) {
    rows = slots.map((slot, index) =>
      buildSlotInsertRow(slot, scheduleId, index, false),
    );
    const retry = await (await floraDb()).from("timetable_slots").upsert(rows, { onConflict: "id" });
    error = retry.error;
  }

  if (error) throw error;
}

async function deleteOrphanScheduleSlots(
  scheduleId: string,
  slotIds: string[],
): Promise<void> {
  if (slotIds.length === 0) {
    const { error } = await (await floraDb())
      .from("timetable_slots")
      .delete()
      .eq("schedule_id", scheduleId);
    if (error) throw error;
    return;
  }

  const { error } = await (await floraDb())
    .from("timetable_slots")
    .delete()
    .eq("schedule_id", scheduleId)
    .not("id", "in", `(${slotIds.join(",")})`);

  if (error) throw error;
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
  const { data, error } = await (await floraDb())
    .from("timetable_slots")
    .select("*")
    .eq("schedule_id", scheduleId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapSlot);
}

export async function loadTimetablePayload(scheduleId: string): Promise<TimetablePayload | null> {
  const { data: scheduleRow, error } = await (await floraDb())
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
  const bundle = await loadTeacherProfileBundle();
  if (bundle?.profile.id) {
    return loadActiveScheduleForProfile(bundle.profile.id);
  }

  const { data, error } = await (await floraDb())
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

export async function loadActiveScheduleForProfile(
  teacherProfileId: string,
): Promise<TimetablePayload | null> {
  const { data, error } = await (await floraDb())
    .from("timetable_schedules")
    .select("*")
    .eq("is_active", true)
    .eq("teacher_profile_id", teacherProfileId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    return loadTimetablePayload(String(data.id));
  }

  const { data: legacy, error: legacyError } = await (await floraDb())
    .from("timetable_schedules")
    .select("*")
    .eq("is_active", true)
    .is("teacher_profile_id", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (legacyError) throw legacyError;
  if (!legacy) return null;

  await (await floraDb())
    .from("timetable_schedules")
    .update({ teacher_profile_id: teacherProfileId, updated_at: new Date().toISOString() })
    .eq("id", legacy.id);

  return loadTimetablePayload(String(legacy.id));
}

export async function listSchedules(teacherProfileId?: string | null): Promise<StoredTimetableSchedule[]> {
  let query = (await floraDb()).from("timetable_schedules").select("*");
  if (teacherProfileId) {
    query = query.eq("teacher_profile_id", teacherProfileId);
  }
  const { data, error } = await query.order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapSchedule);
}

async function appendHistory(
  scheduleId: string,
  action: string,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await (await floraDb()).from("timetable_history").insert({
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

  const { data, error } = await (await floraDb())
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
  const { error } = await (await floraDb())
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
  const slotIds = slots.map((slot) => slot.id);
  await upsertScheduleSlotRows(scheduleId, slots);
  await deleteOrphanScheduleSlots(scheduleId, slotIds);

  const weeklyHours = timetableValidator.computeWeeklyHours(slots);
  const { error: updateError } = await (await floraDb())
    .from("timetable_schedules")
    .update({
      weekly_hours: weeklyHours,
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  if (updateError) throw updateError;

  await appendHistory(scheduleId, action, { slotCount: slots.length });

  const payload = await loadTimetablePayload(scheduleId);
  if (!payload) throw new Error("Emploi du temps introuvable.");
  return payload;
}

async function loadProgrammationWeeklyHours(profileId: string, schoolYear: string): Promise<Record<string, number>[]> {
  const { data, error } = await (await floraDb())
    .from("programmations")
    .select("timetable")
    .eq("teacher_profile_id", profileId)
    .eq("school_year", schoolYear);
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
    weeklyHoursFromProgrammations: bundle?.profile.id
      ? await loadProgrammationWeeklyHours(
          bundle.profile.id,
          base.schedule.schoolYear || bundle.profile.schoolYear || "",
        )
      : [],
    rituals,
    existingSlots: base.slots,
    variantType: input.variantType ?? base.schedule.variantType,
  });

  const { slots, validation } = timetableGenerator.generate(context, input);

  if (input.variantType && input.variantType !== base.schedule.variantType) {
    await (await floraDb())
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

  const meta = readSlotMeta(current);
  const useCustomColor = input.useCustomColor ?? meta.useCustomColor ?? false;
  const subject = input.subject ?? current.subject;
  const subSubject = input.subSubject ?? current.subSubject;
  const subjectChanged = subject !== current.subject;
  const slotType = subjectChanged ? inferSlotType(subject) : current.slotType;
  const label = input.label ?? (subjectChanged ? subject : current.label);
  const start = input.start ?? current.start;
  const end = input.end ?? current.end;
  const day = input.day ?? current.day;

  const appearance = useCustomColor
    ? {
        color: input.color ?? current.color,
        gradient: input.gradient ?? current.gradient,
        borderColor: current.color,
        textColor: "#1a1a1a",
      }
    : resolveSlotAppearance({ subject, subSubject, slotType });

  const nextMetadata = mergeSlotMeta(current, {
    icon: input.icon ?? meta.icon,
    levels: (input.levels as SlotEditorMetadata["levels"]) ?? meta.levels,
    displayText: input.displayText ?? meta.displayText,
    notes: input.notes ?? meta.notes,
    useCustomColor,
    teacherName: input.teacherName ?? meta.teacherName,
  });

  let slots = payload.slots.map((slot) =>
    slot.id === input.slotId
      ? {
          ...slot,
          day,
          start,
          end,
          subject,
          subSubject,
          customText: input.customText ?? current.customText ?? "",
          color: appearance.color,
          gradient: appearance.gradient,
          slotType,
          label,
          room: input.room ?? current.room,
          intervenant: input.intervenant ?? current.intervenant,
          hours: hoursFromSlot({ start, end, hours: slot.hours }),
          metadata: nextMetadata,
        }
      : slot,
  );

  if (input.shiftFollowing && (start !== current.start || end !== current.end)) {
    const delta = durationMinutes(current.end, end) - durationMinutes(current.start, start);
    if (delta !== 0) {
      slots = shiftFollowingSlotsOnDay(slots, day, current.end, delta);
    }
  }

  const conflicts = detectSlotConflicts(slots);
  if (conflicts.some((c) => c.severity === "error")) {
    throw new Error(conflicts[0]?.message ?? "Conflit horaire détecté.");
  }

  const updated = await replaceScheduleSlots(input.scheduleId, sortSlots(slots), "update_slot");
  void pedagogicalEngine.emit({ type: "emploi_du_temps.modifie", scheduleId: input.scheduleId, scope: "slot" });
  return updated;
}

export async function applyTimetableSlotAction(
  input: TimetableSlotActionInput,
): Promise<TimetableActionPayload> {
  const payload = await loadTimetablePayload(input.scheduleId);
  if (!payload) throw new Error("Emploi du temps introuvable.");

  let slots = payload.slots;
  let createdSlotId: string | undefined;

  switch (input.action) {
    case "duplicate": {
      const source = slots.find((s) => s.id === input.slotId);
      if (!source) throw new Error("Créneau introuvable.");
      const copy = duplicateSlot(source, input.scheduleId);
      createdSlotId = copy.id;
      slots = insertSlotAfter(slots, source.id, source.day, copy);
      break;
    }
    case "delete": {
      slots = removeSlot(slots, input.slotId, input.reorganize ?? false);
      break;
    }
    case "merge": {
      const a = slots.find((s) => s.id === input.slotId);
      const b = slots.find((s) => s.id === input.targetSlotId);
      if (!a || !b) throw new Error("Créneaux introuvables.");
      if (a.day !== b.day) throw new Error("La fusion n'est possible que sur le même jour.");
      const merged = mergeTwoSlots(a, b);
      slots = sortSlots(slots.filter((s) => s.id !== b.id).map((s) => (s.id === a.id ? merged : s)));
      break;
    }
    case "split": {
      const source = slots.find((s) => s.id === input.slotId);
      if (!source) throw new Error("Créneau introuvable.");
      const [first, second] = splitSlotAt(
        source,
        input.splitTime,
        input.secondSubject ?? source.subject,
        input.secondSubSubject ?? "",
      );
      slots = sortSlots(slots.filter((s) => s.id !== source.id).concat([first, second]));
      break;
    }
    case "create": {
      const hasExplicitTimes = Boolean(input.start && input.end);
      const start = input.start ?? "08:30";
      const end = input.end ?? "09:30";
      const subject = input.subject ?? "Français";
      const subSubject = input.subSubject ?? "";
      const slotType = inferSlotType(subject);
      const useCustomColor = input.useCustomColor ?? false;
      const appearance = useCustomColor
        ? {
            color: input.color ?? "#9caf88",
            gradient: input.gradient ?? `linear-gradient(145deg, ${input.color ?? "#9caf88"}88 0%, ${input.color ?? "#9caf88"} 100%)`,
          }
        : resolveSlotAppearance({ subject, subSubject, slotType });

      const blank = createBlankSlot({
        scheduleId: input.scheduleId,
        day: input.day,
        start,
        end,
      });

      const newSlot: SmartTimetableSlot = {
        ...blank,
        start: hasExplicitTimes ? start : blank.start,
        end: hasExplicitTimes ? end : blank.end,
        subject,
        subSubject,
        customText: input.customText ?? "",
        color: appearance.color,
        gradient: appearance.gradient,
        slotType,
        label: subject,
        room: input.room ?? "",
        intervenant: input.intervenant ?? input.teacherName ?? "",
        hours: hoursFromSlot({ start, end, hours: 1 }),
        metadata: mergeSlotMeta(blank, {
          icon: input.icon,
          levels: input.levels as SlotEditorMetadata["levels"],
          displayText: input.displayText,
          notes: input.notes,
          useCustomColor,
          teacherName: input.teacherName,
        }),
      };

      slots = insertSlotAfter(slots, input.afterSlotId ?? null, input.day, newSlot, {
        preserveTimes: hasExplicitTimes,
      });
      createdSlotId = newSlot.id;
      break;
    }
    case "move": {
      slots = moveSlotWithinDay(slots, input.slotId, input.direction);
      break;
    }
    case "restore": {
      slots = input.slots;
      break;
    }
    default:
      throw new Error("Action inconnue.");
  }

  const conflicts = detectSlotConflicts(slots);
  if (conflicts.some((c) => c.severity === "error")) {
    throw new Error(conflicts[0]?.message ?? "Conflit horaire détecté.");
  }

  const updated = await replaceScheduleSlots(input.scheduleId, sortSlots(slots), input.action);
  void pedagogicalEngine.emit({ type: "emploi_du_temps.modifie", scheduleId: input.scheduleId, scope: "slot" });
  return { ...updated, ...(createdSlotId ? { createdSlotId } : {}) };
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

  const { data: existing } = await (await floraDb())
    .from("timetable_versions")
    .select("version_number")
    .eq("schedule_id", scheduleId)
    .order("version_number", { ascending: false })
    .limit(1);

  const versionNumber = (existing?.[0]?.version_number ?? 0) + 1;

  const { data, error } = await (await floraDb())
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
  const { data, error } = await (await floraDb())
    .from("timetable_versions")
    .select("*")
    .eq("schedule_id", scheduleId)
    .order("version_number", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapVersion);
}

export async function restoreScheduleVersion(versionId: string): Promise<TimetablePayload> {
  const { data, error } = await (await floraDb())
    .from("timetable_versions")
    .select("*")
    .eq("id", versionId)
    .maybeSingle();

  if (error || !data) throw error ?? new Error("Version introuvable.");

  const snapshot = data.snapshot as TimetablePayload;
  await (await floraDb())
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
  const { data, error } = await (await floraDb())
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
  const bundle = await loadTeacherProfileBundle();
  const profileId = bundle?.profile.id ?? null;

  let deactivateQuery = (await floraDb()).from("timetable_schedules").update({ is_active: false }).eq("is_active", true);
  if (profileId) {
    deactivateQuery = deactivateQuery.eq("teacher_profile_id", profileId);
  }
  await deactivateQuery;

  const activeBase = profileId ? await loadActiveScheduleForProfile(profileId) : await loadActiveSchedule();

  const { data, error } = await (await floraDb())
    .from("timetable_schedules")
    .insert({
      teacher_profile_id: profileId,
      name: `Emploi du temps — ${variantType}`,
      variant_type: variantType,
      is_active: true,
      school_year: activeBase?.schedule.schoolYear ?? bundle?.profile.schoolYear ?? "",
      levels: activeBase?.schedule.levels ?? bundle?.profile.levels ?? [],
      settings: activeBase?.schedule.settings ?? defaultSettings(),
      weekly_hours: {},
      status: "draft",
    })
    .select("*")
    .single();

  if (error || !data) throw error ?? new Error("Impossible de créer la variante.");

  return generateTimetable({ scheduleId: String(data.id), variantType });
}
