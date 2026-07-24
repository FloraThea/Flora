import type { TeacherProfileBundle } from "@/lib/profile/types";
import { dailyPlanner } from "./DailyPlanner";
import {
  listSeancesForJournal,
  loadLibraryResourcesByMatiere,
  mapSeanceRow,
} from "./journal-service";
import type { JournalResources } from "./types";

export type JournalRestitutionInput = {
  journalId: string;
  date: string;
  periodNumber: number;
  weekNumber: number;
  profile: TeacherProfileBundle;
  resolvedDay: Parameters<typeof dailyPlanner.planDay>[0]["resolvedDay"];
};

/**
 * Mode restitution : construit le cahier journal uniquement à partir des données importées.
 * Aucune génération IA, aucune invention de contenu.
 */
export async function planJournalDayFromImports(input: JournalRestitutionInput) {
  const seanceRows = await listSeancesForJournal({
    date: input.date,
    periodNumber: input.periodNumber,
    weekNumber: input.weekNumber,
    teacherProfileId: input.profile.profile.id,
  });

  const seances = seanceRows.map(mapSeanceRow);
  const resourcesByMatiere: Record<string, JournalResources> =
    await loadLibraryResourcesByMatiere();

  const entries = dailyPlanner.planDay({
    journalId: input.journalId,
    resolvedDay: input.resolvedDay,
    profile: input.profile,
    seances,
    resourcesByMatiere,
    linkSeances: true,
    restitutionMode: true,
  });

  return { entries, seances };
}
