import "server-only";

import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import { resolveJournalScheduleSlots, type JournalScheduleSlot } from "./journal-timetable";
import { reconcileJournalEntriesWithTimetable } from "./journal-entry-reconcile";
import { scheduleEngine } from "./ScheduleEngine";
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

  let entries = payload.entries;
  if (
    profileBundle &&
    timetable.hasActiveSchedule &&
    payload.journal.journalDate &&
    payload.journal.metadata?.manualDay !== true
  ) {
    const calendar = schoolWeeksCalculator.calculate(
      profileBundle.profile.schoolYear,
      profileBundle.profile.zoneScolaire,
      { includeBridgeDays: true },
    );
    const resolvedDay = scheduleEngine.resolveDay(
      calendar,
      { slots: timetable.slots, weeklyHoursBySubject: {} },
      payload.journal.journalDate,
      profileBundle.profile.workingDays,
    );
    entries = reconcileJournalEntriesWithTimetable({
      entries: payload.entries,
      daySlots: resolvedDay.slots as JournalScheduleSlot[],
      manualDay: false,
    });
  }

  return applyJournalViewRules(
    { ...payload, entries },
    { hasTimetable: timetable.hasActiveSchedule },
  );
}
