import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import type { TimetablePayload } from "@/lib/timetable/types";
import { loadTimetablePayload } from "@/lib/timetable/timetable-service";

type ScheduleCandidate = {
  scheduleId: string;
  slotCount: number;
  isActive: boolean;
  importSource: string | null;
  updatedAt: string;
};

function scheduleScore(candidate: ScheduleCandidate): number {
  let score = candidate.slotCount;
  if (candidate.importSource) score += 10_000;
  if (candidate.isActive) score += 100;
  return score;
}

async function listScheduleCandidates(teacherProfileId: string): Promise<ScheduleCandidate[]> {
  const client = await floraDb();
  const { data: schedules, error } = await client
    .from("timetable_schedules")
    .select("id, is_active, metadata, updated_at")
    .eq("teacher_profile_id", teacherProfileId);

  if (error) throw error;
  if (!schedules?.length) return [];

  const scheduleIds = schedules.map((row) => String(row.id));
  const { data: slotRows, error: slotsError } = await client
    .from("timetable_slots")
    .select("schedule_id")
    .in("schedule_id", scheduleIds);

  if (slotsError) throw slotsError;

  const counts = new Map<string, number>();
  for (const row of slotRows ?? []) {
    const scheduleId = String(row.schedule_id);
    counts.set(scheduleId, (counts.get(scheduleId) ?? 0) + 1);
  }

  return schedules.map((row) => {
    const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
    return {
      scheduleId: String(row.id),
      slotCount: counts.get(String(row.id)) ?? 0,
      isActive: Boolean(row.is_active),
      importSource: metadata.importSource ? String(metadata.importSource) : null,
      updatedAt: String(row.updated_at ?? ""),
    };
  });
}

/**
 * Résout l'emploi du temps utilisé par le Cahier Journal.
 * Priorité : EDT importé en base > EDT actif > EDT le plus complet.
 * Ne génère jamais de créneaux fictifs.
 */
export async function loadJournalTimetableSchedule(
  teacherProfileId: string,
): Promise<TimetablePayload | null> {
  const candidates = await listScheduleCandidates(teacherProfileId);
  const withSlots = candidates.filter((candidate) => candidate.slotCount > 0);
  if (withSlots.length === 0) {
    const emptyActive = candidates.find((candidate) => candidate.isActive);
    if (emptyActive) {
      return loadTimetablePayload(emptyActive.scheduleId);
    }
    return null;
  }

  const best = [...withSlots].sort((a, b) => {
    const scoreDiff = scheduleScore(b) - scheduleScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return b.updatedAt.localeCompare(a.updatedAt);
  })[0];

  if (!best) return null;
  return loadTimetablePayload(best.scheduleId);
}
