import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { floraDb } from "@/lib/supabase/get-db";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import {
  ensureActiveSchedule,
  loadTimetablePayload,
  replaceScheduleSlots,
} from "../timetable-service";
import { timetableValidator } from "../TimetableValidator";
import type { SmartTimetableSlot, TimetablePayload } from "../types";
import { applySubjectMapping } from "./subject-mapper";
import { parseTimetableFile, applyMappingOverrides } from "./parse-excel";
import type {
  ParsedTimetableImport,
  TimetableImportSaveInput,
  TimetableImportSaveResult,
} from "./types";
import { importSessionToSlot } from "./types";

function isMissingSubjectMappingsTable(error: PostgrestError | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.message.includes("subject_mappings") ||
    error.message.includes("schema cache")
  );
}

function inferMappedDomain(rawSubject: string, mappedSubject: string): string | null {
  const mapped = applySubjectMapping(rawSubject, { [rawSubject]: mappedSubject });
  if (mapped.slotType !== "seance") return mapped.slotType;
  return mappedSubject || null;
}

export async function analyzeTimetableFile(
  buffer: Buffer,
  fileName: string,
  overrides?: Record<string, string>,
  structureOverrides?: import("./types").StructureOverrides,
): Promise<ParsedTimetableImport> {
  return parseTimetableFile(buffer, fileName, overrides, structureOverrides);
}

export async function loadSubjectMappingOverrides(
  teacherProfileId?: string | null,
): Promise<Record<string, string>> {
  if (!teacherProfileId) return {};

  const { data, error } = await (await floraDb())
    .from("subject_mappings")
    .select("raw_subject, mapped_subject")
    .eq("teacher_profile_id", teacherProfileId);

  if (error) {
    if (isMissingSubjectMappingsTable(error)) {
      console.warn("[timetable-import] Table subject_mappings absente — correspondances ignorées.");
      return {};
    }
    throw error;
  }

  return Object.fromEntries(
    (data ?? []).map((row) => [String(row.raw_subject), String(row.mapped_subject)]),
  );
}

export async function saveSubjectMappings(
  mappings: Record<string, string>,
  teacherProfileId?: string | null,
): Promise<void> {
  if (!teacherProfileId || Object.keys(mappings).length === 0) return;

  const rows = Object.entries(mappings).map(([rawSubject, mappedSubject]) => ({
    teacher_profile_id: teacherProfileId,
    user_id: null,
    raw_subject: rawSubject,
    mapped_subject: mappedSubject,
    mapped_domain: inferMappedDomain(rawSubject, mappedSubject),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await (await floraDb()).from("subject_mappings").upsert(rows, {
    onConflict: "teacher_profile_id,raw_subject",
  });

  if (error) {
    if (isMissingSubjectMappingsTable(error)) {
      console.warn(
        "[timetable-import] Table subject_mappings absente — correspondances non enregistrées. " +
          "Appliquez les migrations via le SQL Editor Supabase.",
      );
      return;
    }
    throw error;
  }
}

export async function saveImportedTimetable(
  input: TimetableImportSaveInput,
): Promise<TimetableImportSaveResult> {
  const bundle = await loadTeacherProfileBundle();
  const profile = bundle?.profile;

  let scheduleId = input.scheduleId;

  if (!scheduleId) {
    const base = await ensureActiveSchedule();
    scheduleId = base.schedule.id;

    if (input.scheduleName && input.scheduleName !== base.schedule.name) {
      const { data, error } = await (await floraDb())
        .from("timetable_schedules")
        .insert({
          teacher_profile_id: profile?.id ?? null,
          name: input.scheduleName,
          variant_type: input.variantType ?? "classique",
          is_active: input.isPrimary ?? false,
          school_year: input.schoolYear ?? profile?.schoolYear ?? "",
          levels: profile?.levels ?? [],
          settings: base.schedule.settings,
          weekly_hours: {},
          status: "draft",
          metadata: {
            importSource: input.sourceFileName ?? null,
            className: input.className ?? "",
            teacherName: input.teacherName ?? "",
            importedAt: new Date().toISOString(),
          },
        })
        .select("id")
        .single();

      if (error || !data) throw error ?? new Error("Création emploi du temps impossible.");
      scheduleId = String(data.id);
    }
  }

  if (input.isPrimary && scheduleId) {
    let deactivateQuery = (await floraDb())
      .from("timetable_schedules")
      .update({ is_active: false })
      .neq("id", scheduleId);
    if (profile?.id) {
      deactivateQuery = deactivateQuery.eq("teacher_profile_id", profile.id);
    }
    await deactivateQuery;
    await (await floraDb())
      .from("timetable_schedules")
      .update({ is_active: true, name: input.scheduleName, updated_at: new Date().toISOString() })
      .eq("id", scheduleId);
  }

  if (input.confirmedMappings && profile?.id) {
    await saveSubjectMappings(input.confirmedMappings, profile.id);
  }

  const slots: SmartTimetableSlot[] = input.sessions
    .filter((session) => !session.isEmpty && session.subject)
    .map((session, index) => ({
      ...importSessionToSlot(session, scheduleId!),
      sortOrder: index,
    }));

  const payload = await replaceScheduleSlots(scheduleId!, slots, "import_excel");

  if (profile?.id && slots.length > 0) {
    const { loadActiveScheduleForProfile } = await import("../timetable-service");
    await loadActiveScheduleForProfile(profile.id);
  }

  await (await floraDb())
    .from("timetable_schedules")
    .update({
      name: input.scheduleName,
      school_year: input.schoolYear ?? payload.schedule.schoolYear,
      metadata: {
        ...payload.schedule.metadata,
        importSource: input.sourceFileName ?? null,
        className: input.className ?? "",
        teacherName: input.teacherName ?? "",
        importedAt: new Date().toISOString(),
        validatedAt: new Date().toISOString(),
      },
      status: "validated",
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId);

  const finalPayload = (await loadTimetablePayload(scheduleId!)) ?? payload;

  return {
    ...finalPayload,
    journalSynced: false,
  };
}

export function validateImportSessions(
  sessions: ParsedTimetableImport["sessions"],
  payload: TimetablePayload,
) {
  const slots: SmartTimetableSlot[] = sessions
    .filter((s) => !s.isEmpty && s.subject)
    .map((s, index) => ({
      ...importSessionToSlot(s, payload.schedule.id),
      sortOrder: index,
    }));

  return timetableValidator.validate(
    slots,
    payload.schedule.settings,
    payload.schedule.levels,
    payload.schedule.weeklyHours,
  );
}

export { applyMappingOverrides };
