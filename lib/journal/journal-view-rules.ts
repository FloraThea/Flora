import { isDemoMetadata } from "./journal-entry-utils";
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

export function applyJournalViewRules(
  payload: JournalPayload,
  context: { hasTimetable: boolean },
): EnrichedJournalPayload {
  const manualDay = isManualJournalDay(payload);
  const cleanedEntries = filterDemoEntries(payload.entries);

  if (!context.hasTimetable && !manualDay) {
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
    hasTimetable: context.hasTimetable,
    preview: payload.preview ?? false,
  };
}
