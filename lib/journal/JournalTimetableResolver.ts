import { getDefaultTimetableFromProfile } from "@/lib/profile/profile-service";
import type { TeacherProfileBundle } from "@/lib/profile/types";
import type { TimetableInput } from "@/lib/programming/types";
import { loadActiveSchedule } from "@/lib/timetable/timetable-service";
import type { SmartTimetableSlot } from "@/lib/timetable/types";

function slotsToTimetableInput(slots: SmartTimetableSlot[]): TimetableInput {
  const teachingSlots = slots.filter(
    (slot) => !["recreation", "pause_meridienne"].includes(slot.slotType),
  );

  const weeklyHoursBySubject: Record<string, number> = {};
  for (const slot of teachingSlots) {
    const subject = slot.subject.trim();
    if (!subject) continue;
    weeklyHoursBySubject[subject] = (weeklyHoursBySubject[subject] ?? 0) + (slot.hours || 1);
  }

  return {
    slots: teachingSlots.map((slot) => ({
      day: slot.day,
      start: slot.start,
      end: slot.end,
      subject: slot.subject,
      hours: slot.hours,
    })),
    weeklyHoursBySubject,
  };
}

export async function resolveJournalTimetable(
  profileBundle: TeacherProfileBundle,
): Promise<TimetableInput> {
  const activeSchedule = await loadActiveSchedule();
  if (activeSchedule && activeSchedule.slots.length > 0) {
    return slotsToTimetableInput(activeSchedule.slots);
  }

  return getDefaultTimetableFromProfile(profileBundle);
}
