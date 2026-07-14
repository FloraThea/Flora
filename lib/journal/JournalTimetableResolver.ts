import type { TeacherProfileBundle } from "@/lib/profile/types";
import type { TimetableInput } from "@/lib/programming/types";
import { resolveJournalScheduleSlots } from "./journal-timetable";

export async function resolveJournalTimetable(
  profileBundle: TeacherProfileBundle,
): Promise<TimetableInput & { hasActiveSchedule: boolean; scheduleId: string | null }> {
  const resolved = await resolveJournalScheduleSlots(profileBundle);
  const weeklyHoursBySubject: Record<string, number> = {};

  for (const slot of resolved.slots) {
    if (["recreation", "pause_meridienne"].includes(slot.slotType)) continue;
    const subject = slot.subject.trim();
    if (!subject) continue;
    weeklyHoursBySubject[subject] = (weeklyHoursBySubject[subject] ?? 0) + (slot.hours || 1);
  }

  return {
    slots: resolved.slots,
    weeklyHoursBySubject,
    hasActiveSchedule: resolved.hasActiveSchedule,
    scheduleId: resolved.scheduleId,
  };
}
