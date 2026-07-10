import { DEFAULT_TIMETABLE } from "@/app/programmation/types";
import { supabase } from "@/lib/supabase";
import type { TimetableInput } from "@/lib/programming/types";
import {
  clampWorkQuotaPercentage,
  detectWorkQuotaPreset,
  normalizeWorkingDays,
  resolveWorkQuotaLabel,
} from "./work-schedule";
import { normalizeFloraAppTheme } from "@/lib/themes/types";
import type {
  PersonalizationSettings,
  ProfilSaveInput,
  StoredTeacherPreferences,
  StoredTeacherProfile,
  TeacherMethod,
  TeacherProfileBundle,
  TeacherProject,
  TimetableEntry,
} from "./types";

const DEFAULT_PERSONALIZATION: PersonalizationSettings = {
  accentColor: "rose",
  fontStyle: "mix",
  logoUrl: "",
  className: "",
  schoolName: "",
  signature: "",
  appTheme: "flora",
};

function mapProfile(row: Record<string, unknown>): StoredTeacherProfile {
  let timetables = (row.timetables as TimetableEntry[]) ?? [];
  let defaultTimetableId = String(row.default_timetable_id ?? "");

  if (timetables.length === 0) {
    const defaultEntry: TimetableEntry = {
      id: "default-edt",
      name: "Emploi du temps principal",
      timetable: DEFAULT_TIMETABLE,
    };
    timetables = [defaultEntry];
    defaultTimetableId = defaultEntry.id;
  }

  if (!defaultTimetableId && timetables.length > 0) {
    defaultTimetableId = timetables[0].id;
  }

  return {
    id: String(row.id),
    nom: String(row.nom ?? ""),
    prenom: String(row.prenom ?? ""),
    ecoleNom: String(row.ecole_nom ?? ""),
    commune: String(row.commune ?? ""),
    academie: String(row.academie ?? ""),
    zoneScolaire: (String(row.zone_scolaire ?? "A") || "A") as StoredTeacherProfile["zoneScolaire"],
    pays: String(row.pays ?? "France"),
    schoolYear: String(row.school_year ?? ""),
    levels: (row.levels as StoredTeacherProfile["levels"]) ?? [],
    studentCount: Number(row.student_count ?? 0),
    classType: (row.class_type as StoredTeacherProfile["classType"]) ?? "simple",
    ulis: Boolean(row.ulis),
    segpa: Boolean(row.segpa),
    rep: Boolean(row.rep),
    repPlus: Boolean(row.rep_plus),
    workQuotaPercentage: clampWorkQuotaPercentage(Number(row.work_quota_percentage ?? 100)),
    workQuotaLabel: String(row.work_quota_label ?? "100 %"),
    workingDays: normalizeWorkingDays(row.working_days as string[] | undefined),
    timetables,
    defaultTimetableId,
    personalization: {
      ...DEFAULT_PERSONALIZATION,
      ...((row.personalization as Partial<PersonalizationSettings>) ?? {}),
      appTheme: normalizeFloraAppTheme(
        (row.personalization as Partial<PersonalizationSettings> | undefined)?.appTheme,
      ),
    },
    status: String(row.status ?? "draft"),
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapPreferences(row: Record<string, unknown>): StoredTeacherPreferences {
  return {
    id: String(row.id),
    profileId: String(row.profile_id),
    pedagogyStyles: (row.pedagogy_styles as string[]) ?? [],
    resourcePriorities: (row.resource_priorities as string[]) ?? [],
    aiDetailLevel: (row.ai_detail_level as StoredTeacherPreferences["aiDetailLevel"]) ?? "moyen",
    aiTone: (row.ai_tone as StoredTeacherPreferences["aiTone"]) ?? "simple",
    aiGenerationType:
      (row.ai_generation_type as StoredTeacherPreferences["aiGenerationType"]) ?? "equilibree",
    exportFormats: (row.export_formats as string[]) ?? ["word", "pdf"],
    exportOrder: (row.export_order as string[]) ?? ["word", "pdf", "excel"],
  };
}

function mapMethod(row: Record<string, unknown>): TeacherMethod {
  return {
    id: String(row.id),
    methodName: String(row.method_name ?? ""),
    isPrimary: Boolean(row.is_primary),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function mapProject(row: Record<string, unknown>): TeacherProject {
  return {
    id: String(row.id),
    projectType: (row.project_type as TeacherProject["projectType"]) ?? "annuel",
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

async function loadBundleForProfile(profileRow: Record<string, unknown>): Promise<TeacherProfileBundle> {
  const profile = mapProfile(profileRow);

  const [{ data: preferencesRow }, { data: methodsRows }, { data: projectsRows }] = await Promise.all([
    supabase.from("teacher_preferences").select("*").eq("profile_id", profile.id).maybeSingle(),
    supabase
      .from("teacher_methods")
      .select("*")
      .eq("profile_id", profile.id)
      .order("sort_order"),
    supabase
      .from("teacher_projects")
      .select("*")
      .eq("profile_id", profile.id)
      .order("sort_order"),
  ]);

  let preferences = preferencesRow;

  if (!preferences) {
    const { data: created } = await supabase
      .from("teacher_preferences")
      .insert({ profile_id: profile.id })
      .select("*")
      .single();
    preferences = created;
  }

  return {
    profile,
    preferences: mapPreferences(preferences ?? { profile_id: profile.id }),
    methods: (methodsRows ?? []).map(mapMethod),
    projects: (projectsRows ?? []).map(mapProject),
  };
}

export async function loadTeacherProfileBundle(): Promise<TeacherProfileBundle | null> {
  const { data } = await supabase
    .from("teacher_profiles")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return loadBundleForProfile(data);
}

export async function getOrCreateTeacherProfile(): Promise<TeacherProfileBundle> {
  const existing = await loadTeacherProfileBundle();
  if (existing) return existing;

  const { data: profile, error } = await supabase
    .from("teacher_profiles")
    .insert({ status: "draft" })
    .select("*")
    .single();

  if (error || !profile) {
    throw error ?? new Error("Impossible de créer le profil pédagogique.");
  }

  return loadBundleForProfile(profile);
}

export async function saveTeacherProfileBundle(input: ProfilSaveInput): Promise<TeacherProfileBundle> {
  const current = await getOrCreateTeacherProfile();
  const isComplete =
    input.nom.trim().length > 0 &&
    input.prenom.trim().length > 0 &&
    input.schoolYear.trim().length > 0 &&
    input.levels.length > 0 &&
    input.methods.length > 0 &&
    Boolean(input.defaultTimetableId);

  const { data: profile, error } = await supabase
    .from("teacher_profiles")
    .update({
      nom: input.nom,
      prenom: input.prenom,
      ecole_nom: input.ecoleNom,
      commune: input.commune,
      academie: input.academie,
      zone_scolaire: input.zoneScolaire,
      pays: input.pays,
      school_year: input.schoolYear,
      levels: input.levels,
      student_count: input.studentCount,
      class_type: input.classType,
      ulis: input.ulis,
      segpa: input.segpa,
      rep: input.rep,
      rep_plus: input.repPlus,
      work_quota_percentage: clampWorkQuotaPercentage(input.workQuotaPercentage),
      work_quota_label:
        input.workQuotaLabel.trim() ||
        resolveWorkQuotaLabel(input.workQuotaPercentage, input.workQuotaPreset),
      working_days: normalizeWorkingDays(input.workingDays),
      timetables: input.timetables,
      default_timetable_id: input.defaultTimetableId,
      personalization: input.personalization,
      status: isComplete ? "complete" : "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", current.profile.id)
    .select("*")
    .single();

  if (error || !profile) {
    throw error ?? new Error("Impossible d'enregistrer le profil.");
  }

  const { error: preferencesError } = await supabase
    .from("teacher_preferences")
    .update({
      pedagogy_styles: input.pedagogyStyles,
      resource_priorities: input.resourcePriorities,
      ai_detail_level: input.aiDetailLevel,
      ai_tone: input.aiTone,
      ai_generation_type: input.aiGenerationType,
      export_formats: input.exportFormats,
      export_order: input.exportOrder,
      updated_at: new Date().toISOString(),
    })
    .eq("profile_id", current.profile.id);

  if (preferencesError) throw preferencesError;

  await supabase.from("teacher_methods").delete().eq("profile_id", current.profile.id);
  await supabase.from("teacher_projects").delete().eq("profile_id", current.profile.id);

  if (input.methods.length > 0) {
    const { error: methodsError } = await supabase.from("teacher_methods").insert(
      input.methods.map((methodName, index) => ({
        profile_id: current.profile.id,
        method_name: methodName,
        is_primary: methodName === input.primaryMethod,
        sort_order: index,
      })),
    );
    if (methodsError) throw methodsError;
  }

  if (input.projects.length > 0) {
    const { error: projectsError } = await supabase.from("teacher_projects").insert(
      input.projects.map((project, index) => ({
        profile_id: current.profile.id,
        project_type: project.projectType,
        title: project.title,
        description: project.description,
        sort_order: index,
      })),
    );
    if (projectsError) throw projectsError;
  }

  return loadBundleForProfile(profile);
}

export function getDefaultTimetableFromProfile(bundle: TeacherProfileBundle): TimetableInput {
  const entry = bundle.profile.timetables.find(
    (item) => item.id === bundle.profile.defaultTimetableId,
  );
  return entry?.timetable ?? bundle.profile.timetables[0]?.timetable ?? { slots: [], weeklyHoursBySubject: {} };
}

export function bundleToFormValues(bundle: TeacherProfileBundle): ProfilSaveInput {
  const primary =
    bundle.methods.find((method) => method.isPrimary)?.methodName ?? bundle.methods[0]?.methodName ?? "";

  return {
    nom: bundle.profile.nom,
    prenom: bundle.profile.prenom,
    ecoleNom: bundle.profile.ecoleNom,
    commune: bundle.profile.commune,
    academie: bundle.profile.academie,
    zoneScolaire: bundle.profile.zoneScolaire,
    pays: bundle.profile.pays,
    schoolYear: bundle.profile.schoolYear,
    levels: bundle.profile.levels,
    studentCount: bundle.profile.studentCount,
    classType: bundle.profile.classType,
    ulis: bundle.profile.ulis,
    segpa: bundle.profile.segpa,
    rep: bundle.profile.rep,
    repPlus: bundle.profile.repPlus,
    workQuotaPercentage: bundle.profile.workQuotaPercentage,
    workQuotaLabel: bundle.profile.workQuotaLabel,
    workQuotaPreset: detectWorkQuotaPreset(bundle.profile.workQuotaPercentage),
    workingDays: bundle.profile.workingDays,
    timetables: bundle.profile.timetables,
    defaultTimetableId: bundle.profile.defaultTimetableId,
    methods: bundle.methods.map((method) => method.methodName),
    primaryMethod: primary,
    pedagogyStyles: bundle.preferences.pedagogyStyles,
    projects: bundle.projects,
    resourcePriorities: bundle.preferences.resourcePriorities,
    aiDetailLevel: bundle.preferences.aiDetailLevel,
    aiTone: bundle.preferences.aiTone,
    aiGenerationType: bundle.preferences.aiGenerationType,
    personalization: bundle.profile.personalization,
    exportFormats: bundle.preferences.exportFormats,
    exportOrder: bundle.preferences.exportOrder,
  };
}
