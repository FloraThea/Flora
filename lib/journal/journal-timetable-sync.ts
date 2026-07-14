import "server-only";

import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import { supabase } from "@/lib/supabase";
import { dailyPlanner } from "./DailyPlanner";
import { findJournalByDate, loadJournalPayload } from "./journal-service";
import { resolveJournalScheduleSlots } from "./journal-timetable";
import { isNonPedagogicalSlot } from "./journal-slot-utils";
import { scheduleEngine } from "./ScheduleEngine";
import type { JournalEntry, TimetableRefreshChange, TimetableRefreshPreview } from "./types";

import { isJournalEntryProtected, journalSlotKey } from "./journal-entry-utils";

async function buildCurrentTimetableEntries(date: string): Promise<JournalEntry[]> {
  const profileBundle = await loadTeacherProfileBundle();
  if (!profileBundle) {
    throw new Error("Profil enseignant requis.");
  }

  const timetable = await resolveJournalScheduleSlots(profileBundle);
  const calendar = schoolWeeksCalculator.calculate(
    profileBundle.profile.schoolYear,
    profileBundle.profile.zoneScolaire,
    { includeBridgeDays: true },
  );

  const resolvedDay = scheduleEngine.resolveDay(
    calendar,
    { slots: timetable.slots, weeklyHoursBySubject: {} },
    date,
    profileBundle.profile.workingDays,
  );

  const draftEntries = dailyPlanner.planDay({
    journalId: "timetable-refresh",
    resolvedDay,
    profile: profileBundle,
    seances: [],
    resourcesByMatiere: {},
    linkSeances: false,
  });

  return draftEntries.map((entry, index) => ({
    ...entry,
    id: `timetable-entry-${index}`,
    observation: null,
  }));
}

export async function previewTimetableRefresh(date: string): Promise<TimetableRefreshPreview> {
  const profileBundle = await loadTeacherProfileBundle();
  if (!profileBundle) {
    throw new Error("Profil enseignant requis.");
  }

  const existing = await findJournalByDate(date, profileBundle.profile.id);
  if (!existing) {
    return {
      date,
      journalId: null,
      changes: [],
      preservedCount: 0,
      updatableCount: 0,
      message: "Aucun cahier journal enregistré pour cette date.",
    };
  }

  const payload = await loadJournalPayload(existing.id);
  if (!payload) {
    throw new Error("Cahier journal introuvable.");
  }

  const timetableEntries = await buildCurrentTimetableEntries(date);
  const previewByKey = new Map(timetableEntries.map((entry) => [journalSlotKey(entry), entry]));

  const changes: TimetableRefreshChange[] = [];
  let preservedCount = 0;
  let updatableCount = 0;

  for (const entry of payload.entries) {
    if (entry.entryType === "break" || isNonPedagogicalSlot(String(entry.slotData.slotType ?? ""))) {
      continue;
    }

    if (isJournalEntryProtected(entry)) {
      preservedCount += 1;
      continue;
    }

    updatableCount += 1;
    const match = previewByKey.get(journalSlotKey(entry));
    if (!match) continue;

    if (match.startTime !== entry.startTime) {
      changes.push({
        entryId: entry.id,
        matiere: entry.matiere,
        field: "startTime",
        previousValue: entry.startTime,
        nextValue: match.startTime,
      });
    }
    if (match.endTime !== entry.endTime) {
      changes.push({
        entryId: entry.id,
        matiere: entry.matiere,
        field: "endTime",
        previousValue: entry.endTime,
        nextValue: match.endTime,
      });
    }
    if (match.matiere !== entry.matiere) {
      changes.push({
        entryId: entry.id,
        matiere: entry.matiere,
        field: "matiere",
        previousValue: entry.matiere,
        nextValue: match.matiere,
      });
    }
    const nextSub = String(match.slotData.subSubject ?? "");
    const prevSub = String(entry.slotData.subSubject ?? "");
    if (nextSub !== prevSub) {
      changes.push({
        entryId: entry.id,
        matiere: entry.matiere,
        field: "subSubject",
        previousValue: prevSub,
        nextValue: nextSub,
      });
    }
  }

  return {
    date,
    journalId: existing.id,
    changes,
    preservedCount,
    updatableCount,
    message:
      changes.length > 0
        ? `${changes.length} modification(s) horaire(s) proposée(s). Les créneaux déjà complétés seront conservés.`
        : "L'emploi du temps actuel correspond déjà au cahier journal enregistré.",
  };
}

export async function applyTimetableRefresh(date: string): Promise<TimetableRefreshPreview> {
  const preview = await previewTimetableRefresh(date);
  if (!preview.journalId || preview.changes.length === 0) {
    return preview;
  }

  const payload = await loadJournalPayload(preview.journalId);
  if (!payload) throw new Error("Cahier journal introuvable.");

  const changesByEntry = new Map<string, TimetableRefreshChange[]>();
  for (const change of preview.changes) {
    const list = changesByEntry.get(change.entryId) ?? [];
    list.push(change);
    changesByEntry.set(change.entryId, list);
  }

  for (const entry of payload.entries) {
    const entryChanges = changesByEntry.get(entry.id);
    if (!entryChanges?.length) continue;

    const patch: Record<string, unknown> = {};
    const slotData = { ...entry.slotData };

    for (const change of entryChanges) {
      if (change.field === "startTime") patch.start_time = change.nextValue;
      if (change.field === "endTime") patch.end_time = change.nextValue;
      if (change.field === "matiere") patch.matiere = change.nextValue;
      if (change.field === "subSubject") slotData.subSubject = change.nextValue;
    }

    patch.slot_data = slotData;
    patch.metadata = {
      ...entry.metadata,
      refreshedFromTimetableAt: new Date().toISOString(),
    };

    await supabase.from("journal_entries").update(patch).eq("id", entry.id);
  }

  return preview;
}
