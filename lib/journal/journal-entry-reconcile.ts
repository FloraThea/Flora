import type { JournalScheduleSlot } from "./journal-timetable";
import { isNonPedagogicalSlot } from "./journal-slot-utils";
import { isDemoMetadata, isJournalEntryProtected, journalSlotKey } from "./journal-entry-utils";
import type { JournalEntry } from "./types";

function entryPriority(entry: JournalEntry): number {
  if (isJournalEntryProtected(entry)) return 3;
  const fillState = String(entry.metadata.fillState ?? "");
  if (fillState === "linked") return 2;
  if (fillState === "generated") return 1;
  return 0;
}

function slotKeysForDay(slots: JournalScheduleSlot[]): Set<string> {
  const keys = new Set<string>();
  for (const slot of slots) {
    if (slot.sourceScheduleSlotId) {
      keys.add(`id:${slot.sourceScheduleSlotId}`);
    }
    keys.add(`${slot.start}|${slot.end}|${slot.subject.toLowerCase()}`);
    keys.add(`${slot.start}|${slot.subject.toLowerCase()}`);
  }
  return keys;
}

function entryMatchesTimetable(entry: JournalEntry, validKeys: Set<string>): boolean {
  const key = journalSlotKey(entry);
  if (validKeys.has(key)) return true;

  const altKey = `${entry.startTime}|${entry.endTime}|${entry.matiere.toLowerCase()}`;
  if (validKeys.has(altKey)) return true;

  const altStartKey = `${entry.startTime}|${entry.matiere.toLowerCase()}`;
  return validKeys.has(altStartKey);
}

export function dedupeJournalEntries(entries: JournalEntry[]): JournalEntry[] {
  const grouped = new Map<string, JournalEntry[]>();

  for (const entry of entries) {
    const key = journalSlotKey(entry);
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }

  const deduped: JournalEntry[] = [];
  for (const group of grouped.values()) {
    group.sort((a, b) => entryPriority(b) - entryPriority(a));
    deduped.push(group[0]!);
  }

  return deduped.sort((a, b) => a.sortOrder - b.sortOrder);
}

export function reconcileJournalEntriesWithTimetable(input: {
  entries: JournalEntry[];
  daySlots: JournalScheduleSlot[];
  manualDay?: boolean;
}): JournalEntry[] {
  const cleaned = input.entries.filter((entry) => !isDemoMetadata(entry.metadata));
  if (input.manualDay) return dedupeJournalEntries(cleaned);

  const validKeys = slotKeysForDay(input.daySlots);
  if (validKeys.size === 0) return [];

  const matched = cleaned.filter((entry) => {
    if (entry.entryType === "break" || isNonPedagogicalSlot(String(entry.slotData.slotType ?? ""))) {
      return entryMatchesTimetable(entry, validKeys);
    }
    return entryMatchesTimetable(entry, validKeys);
  });

  return dedupeJournalEntries(matched);
}
