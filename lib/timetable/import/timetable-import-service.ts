import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { floraDb } from "@/lib/supabase/get-db";
import { getOrCreateTeacherProfile } from "@/lib/profile/profile-service";
import { getSchoolDaysFromWorkingDays } from "@/lib/profile/work-schedule";
import {
  loadActiveScheduleForProfile,
  loadTimetablePayload,
  promoteScheduleAsActive,
  replaceScheduleSlots,
} from "../timetable-service";
import { timetableValidator } from "../TimetableValidator";
import type { SmartTimetableSlot, TimetablePayload } from "../types";
import { createDefaultTimetableSettings } from "../types";
import { edtImportTrace } from "./edt-import-trace";
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
  const bundle = await getOrCreateTeacherProfile();
  const profile = bundle.profile;
  edtImportTrace("EDT-06", { profileId: profile.id, status: "save_profile" });

  let scheduleId = input.scheduleId;
  const basePayload = await loadActiveScheduleForProfile(profile.id);
  const baseSettings = basePayload?.schedule.settings ?? {
    ...createDefaultTimetableSettings(),
    schoolDays: getSchoolDaysFromWorkingDays(profile.workingDays ?? []),
  };

  if (!scheduleId) {
    const { data, error } = await (await floraDb())
      .from("timetable_schedules")
      .insert({
        teacher_profile_id: profile.id,
        name: input.scheduleName ?? "Emploi du temps importé",
        variant_type: input.variantType ?? "classique",
        is_active: input.isPrimary ?? true,
        school_year: input.schoolYear ?? profile.schoolYear ?? "",
        levels: profile.levels ?? [],
        settings: baseSettings,
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

  if (scheduleId) {
    const { error: attachError } = await (await floraDb())
      .from("timetable_schedules")
      .update({
        teacher_profile_id: profile.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduleId);

    if (attachError) throw attachError;
  }

  if (input.isPrimary !== false && scheduleId) {
    await promoteScheduleAsActive(scheduleId, profile.id);
    if (input.scheduleName) {
      const { error: renameError } = await (await floraDb())
        .from("timetable_schedules")
        .update({ name: input.scheduleName, updated_at: new Date().toISOString() })
        .eq("id", scheduleId);
      if (renameError) throw renameError;
    }
  }

  if (input.confirmedMappings) {
    await saveSubjectMappings(input.confirmedMappings, profile.id);
  }

  const slots: SmartTimetableSlot[] = input.sessions
    .filter((session) => !session.isEmpty && (session.rawLabel.trim() || session.subject.trim()))
    .map((session, index) => ({
      ...importSessionToSlot(session, scheduleId!),
      sortOrder: index,
    }));

  if (slots.length === 0) {
    throw new Error("Aucun créneau valide à enregistrer.");
  }

  const payload = await replaceScheduleSlots(scheduleId!, slots, "import_excel");
  edtImportTrace("EDT-11", {
    profileId: profile.id,
    scheduleId,
    status: "slots_saved",
    slotCount: slots.length,
  });

  await promoteScheduleAsActive(scheduleId!, profile.id);
  edtImportTrace("EDT-12", {
    profileId: profile.id,
    scheduleId,
    status: "schedule_active",
    slotCount: slots.length,
  });

  const { error: scheduleUpdateError } = await (await floraDb())
    .from("timetable_schedules")
    .update({
      name: input.scheduleName,
      school_year: input.schoolYear ?? payload.schedule.schoolYear,
      teacher_profile_id: profile.id,
      is_active: true,
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

  if (scheduleUpdateError) throw scheduleUpdateError;

  edtImportTrace("EDT-13", {
    profileId: profile.id,
    scheduleId,
    status: "save_ready",
    slotCount: payload.slots.length,
  });

  return {
    ...payload,
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
