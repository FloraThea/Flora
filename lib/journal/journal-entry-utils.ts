import type { JournalEntry } from "./types";

export function isJournalEntryProtected(entry: JournalEntry): boolean {
  const fillState = String(entry.metadata.fillState ?? "");
  if (fillState === "manual" || fillState === "generated" || fillState === "linked") {
    return Boolean(entry.objectif?.trim() || entry.competence?.trim() || entry.organisation?.trim());
  }
  return false;
}

export function journalSlotKey(entry: Pick<JournalEntry, "startTime" | "matiere" | "slotData">): string {
  const sourceId = entry.slotData.sourceScheduleSlotId;
  if (sourceId) return `id:${String(sourceId)}`;
  return `${entry.startTime}|${entry.matiere.toLowerCase()}`;
}

export function isDemoMetadata(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  const record = metadata as Record<string, unknown>;
  if (record.demo === true || record.isDemo === true) return true;
  if (record.source === "seed" || record.source === "demo") return true;
  if (record.isPreview === true && record.missingTimetable !== true) return false;
  return false;
}
