import "server-only";

import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { resolveJournalScheduleSlots } from "./journal-timetable";
import { applyJournalViewRules, type EnrichedJournalPayload } from "./journal-view-rules";
import type { JournalPayload } from "./types";

export type { EnrichedJournalPayload } from "./journal-view-rules";
export { applyJournalViewRules } from "./journal-view-rules";

/**
 * Attache les indicateurs d'affichage cohérents (EDT actif, pas de cartes orphelines).
 */
export async function enrichJournalPayload(payload: JournalPayload): Promise<EnrichedJournalPayload> {
  const profileBundle = await loadTeacherProfileBundle();
  const timetable = profileBundle
    ? await resolveJournalScheduleSlots(profileBundle)
    : { hasActiveSchedule: false, slots: [], scheduleId: null };

  return applyJournalViewRules(payload, { hasTimetable: timetable.hasActiveSchedule });
}
