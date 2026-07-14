import "server-only";

import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { isDemoMetadata } from "./journal-entry-utils";
import { resolveJournalScheduleSlots } from "./journal-timetable";
import type { JournalEntry, JournalPayload } from "./types";

export type EnrichedJournalPayload = JournalPayload & {
  hasTimetable: boolean;
  noClassDay?: boolean;
  specialDayMessage?: string;
};

function filterDemoEntries(entries: JournalEntry[]): JournalEntry[] {
  return entries.filter((entry) => !isDemoMetadata(entry.metadata));
}

function isManualJournalDay(payload: JournalPayload): boolean {
  return payload.journal.metadata?.manualDay === true;
}

/**
 * Attache les indicateurs d'affichage cohérents (EDT actif, pas de cartes orphelines).
 */
export async function enrichJournalPayload(payload: JournalPayload): Promise<EnrichedJournalPayload> {
  const profileBundle = await loadTeacherProfileBundle();
  const timetable = profileBundle
    ? await resolveJournalScheduleSlots(profileBundle)
    : { hasActiveSchedule: false, slots: [], scheduleId: null };

  const hasTimetable = timetable.hasActiveSchedule;
  const manualDay = isManualJournalDay(payload);
  const cleanedEntries = filterDemoEntries(payload.entries);

  if (!hasTimetable && !manualDay) {
    return {
      ...payload,
      entries: [],
      hasTimetable: false,
      preview: payload.preview ?? false,
      specialDayMessage:
        payload.specialDayMessage ??
        "Aucun emploi du temps n'est encore disponible. Créez ou importez votre emploi du temps pour générer les plages horaires.",
    };
  }

  return {
    ...payload,
    entries: cleanedEntries,
    hasTimetable,
    preview: payload.preview ?? false,
  };
}
