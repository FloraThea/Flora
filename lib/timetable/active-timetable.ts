import type { TimetableInput } from "@/lib/programming/types";
import { EMPTY_TIMETABLE, payloadToTimetableInput } from "./timetable-input-utils";
import { loadActiveScheduleForProfile } from "./timetable-service";

export { EMPTY_TIMETABLE, payloadToTimetableInput } from "./timetable-input-utils";

/** Source unique de l'emploi du temps : timetable_schedules + timetable_slots */
export async function loadActiveTimetableInput(profileId: string): Promise<TimetableInput> {
  const payload = await loadActiveScheduleForProfile(profileId);
  if (!payload || payload.slots.length === 0) {
    return EMPTY_TIMETABLE;
  }

  return payloadToTimetableInput(
    payload.slots.map((slot) => ({
      day: slot.day,
      start: slot.start,
      end: slot.end,
      subject: slot.subject,
      hours: slot.hours,
      slotType: slot.slotType,
    })),
  );
}

export async function hasActiveTimetableWithSlots(profileId: string): Promise<boolean> {
  const payload = await loadActiveScheduleForProfile(profileId);
  return Boolean(payload && payload.slots.length > 0);
}
