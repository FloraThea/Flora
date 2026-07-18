import { cache } from "react";
import { floraDb } from "@/lib/supabase/get-db";
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
  const timetables = (row.timetables as TimetableEntry[]) ?? [];
  const defaultTimetableId = String(row.default_timetable_id ?? "");

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

async function loadBundleForProfile(
  profileRow: Record<string, unknown>,
  client: Awaited<ReturnType<typeof floraDb>>,
): Promise<TeacherProfileBundle> {
  const profile = mapProfile(profileRow);

  const [{ data: preferencesRow }, { data: methodsRows }, { data: projectsRows }] = await Promise.all([
    client.from("teacher_preferences").select("*").eq("profile_id", profile.id).maybeSingle(),
    client
      .from("teacher_methods")
      .select("*")
      .eq("profile_id", profile.id)
      .order("sort_order"),
    client
      .from("teacher_projects")
      .select("*")
      .eq("profile_id", profile.id)
      .order("sort_order"),
  ]);

  let preferences = preferencesRow;

  if (!preferences) {
    const { data: created } = await client
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

export const loadTeacherProfileBundle = cache(async (): Promise<TeacherProfileBundle | null> => {
  const client = await floraDb();
  let userId: string | null = null;
  if (typeof window === "undefined") {
    try {
      const { getServerAuthUserId } = await import("@/lib/supabase/auth-server");
      userId = await getServerAuthUserId();
    } catch {
      userId = null;
    }
  }

  let query = client.from("teacher_profiles").select("*");
  if (userId) {
    query = query.eq("user_id", userId);
  } else if (process.env.NODE_ENV === "production") {
    return null;
  } else {
    query = query.order("created_at", { ascending: true });
  }

  const { data } = await query.limit(1).maybeSingle();

  if (!data) return null;
  return loadBundleForProfile(data, client);
});

export async function getOrCreateTeacherProfile(): Promise<TeacherProfileBundle> {
  const client = await floraDb();
  const existing = await loadTeacherProfileBundle();
  if (existing) return existing;

  let userId: string | null = null;
  if (typeof window === "undefined") {
    try {
      const { getServerAuthUserId, linkTeacherProfileToAuthUser } = await import(
        "@/lib/supabase/auth-server"
      );
      userId = await getServerAuthUserId();
      if (userId) {
        const profileId = await linkTeacherProfileToAuthUser(userId);
        const { data: linked } = await client
          .from("teacher_profiles")
          .select("*")
          .eq("id", profileId)
          .single();
        if (linked) return loadBundleForProfile(linked, client);
      }
    } catch {
      userId = null;
    }
  }

  const { data: profile, error } = await client
    .from("teacher_profiles")
    .insert({ status: "draft", user_id: userId })
    .select("*")
    .single();

  if (error || !profile) {
    throw error ?? new Error("Impossible de créer le profil pédagogique.");
  }

  return loadBundleForProfile(profile, client);
}

export async function saveTeacherProfileBundle(input: ProfilSaveInput): Promise<TeacherProfileBundle> {
  const client = await floraDb();
  const current = await getOrCreateTeacherProfile();
  const isComplete =
    input.nom.trim().length > 0 &&
    input.prenom.trim().length > 0 &&
    input.schoolYear.trim().length > 0 &&
    input.levels.length > 0 &&
    input.methods.length > 0;

  const { data: profile, error } = await client
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
      timetables: [],
      default_timetable_id: "",
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

  const { error: preferencesError } = await client
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

  await client.from("teacher_methods").delete().eq("profile_id", current.profile.id);
  await client.from("teacher_projects").delete().eq("profile_id", current.profile.id);

  if (input.methods.length > 0) {
    const { error: methodsError } = await client.from("teacher_methods").insert(
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
    const { error: projectsError } = await client.from("teacher_projects").insert(
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

  return loadBundleForProfile(profile, client);
}

export async function getDefaultTimetableFromProfile(bundle: TeacherProfileBundle): Promise<TimetableInput> {
  const { loadActiveTimetableInput } = await import("@/lib/timetable/active-timetable");
  return loadActiveTimetableInput(bundle.profile.id);
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
    timetables: [],
    defaultTimetableId: "",
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
