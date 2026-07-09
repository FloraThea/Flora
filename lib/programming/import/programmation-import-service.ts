import { supabase } from "@/lib/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-errors";
import { loadTeacherProfileForGeneration } from "@/lib/profile/profile-context";
import { getDefaultTimetableFromProfile } from "@/lib/profile/profile-service";
import { schoolWeeksCalculator } from "../SchoolWeeksCalculator";
import type { ProgrammingGenerationInput, ProgrammationPayload } from "../types";
import { programmingValidator } from "../ProgrammingValidator";
import { saveProgrammation } from "../programmation-service";
import { adaptRowsToCalendar } from "./adapt-programmation";
import { applyCompetencyMatchesToRows, matchImportedCompetencies } from "./competency-match";
import { parseProgrammationFile } from "./parse-programmation";
import type { ProgrammationFormatConfig, ProgrammationImportSession } from "./types";
import { DEFAULT_FORMAT_CONFIG } from "./types";
import { buildProgrammationStoragePath, getStorageBucketName } from "@/lib/supabase/storage-config";

export async function analyzeProgrammationImport(input: {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
  pastedText?: string;
}) {
  return parseProgrammationFile(input);
}

export async function buildImportSession(input: {
  parsed: Awaited<ReturnType<typeof parseProgrammationFile>>;
  schoolYear: string;
  academicZone: ProgrammingGenerationInput["academicZone"];
  levels: ProgrammingGenerationInput["levels"];
  matiere: string;
  formatConfig?: ProgrammationFormatConfig;
}): Promise<ProgrammationImportSession> {
  const bundle = await loadTeacherProfileForGeneration();

  const calendar = schoolWeeksCalculator.calculate(
    input.schoolYear,
    input.academicZone,
    { teacherWorkingDays: bundle.profile.workingDays },
  );

  const competencyMatches = await matchImportedCompetencies(input.parsed.rows);
  const correctedRows = applyCompetencyMatchesToRows(input.parsed.rows, competencyMatches);

  const { tables, plan } = adaptRowsToCalendar({
    rows: correctedRows,
    calendar,
    matiere: input.matiere || input.parsed.discipline,
    discipline: input.parsed.discipline,
  });

  return {
    parsed: input.parsed,
    adaptation: plan,
    calendar,
    competencyMatches,
    formatConfig: input.formatConfig ?? DEFAULT_FORMAT_CONFIG,
    tables,
    schoolYear: input.schoolYear,
    academicZone: input.academicZone,
    levels: input.levels,
    matiere: input.matiere || input.parsed.discipline,
  };
}

export async function saveImportedProgrammation(input: {
  session: ProgrammationImportSession;
  title: string;
  sourceFileName?: string;
  sourceStoragePath?: string;
}): Promise<ProgrammationPayload> {
  const bundle = await loadTeacherProfileForGeneration();
  const defaultTimetable = getDefaultTimetableFromProfile(bundle);
  const validation = programmingValidator.validate(input.session.tables, {
    referentiel: [],
    resources: [],
    calendar: input.session.calendar,
    timetable: defaultTimetable,
  });

  const generationInput: ProgrammingGenerationInput = {
    schoolYear: input.session.schoolYear,
    academicZone: input.session.academicZone,
    levels: input.session.levels,
    matiere: input.session.matiere,
    methode: bundle.methods[0]?.methodName ?? "",
    projetAnnuel: "",
    timetable: defaultTimetable,
    teacherWorkingDays: bundle.profile.workingDays,
  };

  return saveProgrammation({
    title: input.title,
    generationInput,
    calendarSnapshot: input.session.calendar,
    validation,
    tables: input.session.tables,
    importMeta: {
      sourceType: "imported",
      sourceFileName: input.sourceFileName ?? input.session.parsed.fileName,
      sourceStoragePath: input.sourceStoragePath ?? "",
      discipline: input.session.parsed.discipline,
      originalImport: input.session.parsed as unknown as Record<string, unknown>,
      adaptedImport: { tables: input.session.tables },
      importAdaptation: input.session.adaptation as unknown as Record<string, unknown>,
      formatConfig: input.session.formatConfig as unknown as Record<string, unknown>,
      competencyMatches: input.session.competencyMatches as unknown as Record<string, unknown>,
    },
  });
}

export async function uploadImportSourceFile(
  profileId: string,
  file: File,
): Promise<{ storagePath: string; publicUrl: string }> {
  const bucket = getStorageBucketName();
  const storagePath = buildProgrammationStoragePath(profileId, file.name);

  const { error } = await supabase.storage.from(bucket).upload(storagePath, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Archivage du document source impossible."));
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl };
}
