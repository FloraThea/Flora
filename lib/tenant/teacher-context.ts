import "server-only";

import { loadTeacherProfileBundle, getOrCreateTeacherProfile } from "@/lib/profile/profile-service";
import type { TeacherProfileBundle } from "@/lib/profile/types";

export type TeacherScope = {
  profileId: string;
  schoolYear: string;
  className: string;
  zoneScolaire: "A" | "B" | "C";
};

export async function requireTeacherScope(): Promise<TeacherScope & { bundle: TeacherProfileBundle }> {
  const bundle = await getOrCreateTeacherProfile();
  const schoolYear = bundle.profile.schoolYear.trim();
  if (!schoolYear) {
    throw new Error("Année scolaire requise. Complétez votre profil pédagogique.");
  }

  return {
    bundle,
    profileId: bundle.profile.id,
    schoolYear,
    className: bundle.profile.personalization.className.trim(),
    zoneScolaire: bundle.profile.zoneScolaire,
  };
}

export async function tryTeacherScope(): Promise<(TeacherScope & { bundle: TeacherProfileBundle }) | null> {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle?.profile.id) return null;
  const schoolYear = bundle.profile.schoolYear.trim();
  if (!schoolYear) return null;

  return {
    bundle,
    profileId: bundle.profile.id,
    schoolYear,
    className: bundle.profile.personalization.className.trim(),
    zoneScolaire: bundle.profile.zoneScolaire,
  };
}

export function scopeProgrammationsQuery(
  query: { eq: (col: string, val: string) => unknown },
  scope: TeacherScope,
) {
  return (query.eq("teacher_profile_id", scope.profileId) as typeof query).eq(
    "school_year",
    scope.schoolYear,
  );
}

export function scopeByProfileQuery(
  query: { eq: (col: string, val: string) => unknown },
  profileId: string,
) {
  return query.eq("teacher_profile_id", profileId);
}
