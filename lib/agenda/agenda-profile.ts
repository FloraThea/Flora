import { getOrCreateTeacherProfile } from "@/lib/profile/profile-service";
import type { TeacherProfileBundle } from "@/lib/profile/types";

export type AgendaProfileContext = {
  bundle: TeacherProfileBundle;
  needsSchoolYearSetup: boolean;
};

export async function resolveAgendaProfile(): Promise<AgendaProfileContext | null> {
  try {
    const bundle = await getOrCreateTeacherProfile();
    return {
      bundle,
      needsSchoolYearSetup: !bundle.profile.schoolYear?.trim(),
    };
  } catch (error) {
    console.error("[agenda] Profil indisponible :", error);
    return null;
  }
}

export function isMissingAgendaTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("does not exist") ||
    message.includes("PGRST205") ||
    message.includes("schema cache") ||
    message.includes("agenda_events")
  );
}

export function toAgendaUserMessage(error: unknown): string {
  if (isMissingAgendaTableError(error)) {
    return "Le module agenda n'est pas encore initialisé en base de données.";
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Profil enseignant")) {
    return "Configurez votre profil pédagogique pour utiliser l'agenda.";
  }
  return "L'agenda n'a pas pu être chargé.";
}
