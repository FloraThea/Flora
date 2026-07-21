import type { TeacherProfileBundle } from "@/lib/profile/types";
import type { TimetableSlot } from "@/lib/programming/types";
import { loadJournalTimetableSchedule } from "./journal-schedule-resolver";

export type JournalScheduleSlot = TimetableSlot & {
  slotType: string;
  subSubject?: string;
  customText?: string;
  color?: string;
  sourceScheduleSlotId?: string;
};

export type ResolvedJournalTimetable = {
  slots: JournalScheduleSlot[];
  scheduleId: string | null;
  hasActiveSchedule: boolean;
};

export function isNonPedagogicalSlot(slotType: string): boolean {
  return ["recreation", "pause_meridienne"].includes(slotType);
}

export async function resolveJournalScheduleSlots(
  profileBundle: TeacherProfileBundle,
): Promise<ResolvedJournalTimetable> {
  const schedule = await loadJournalTimetableSchedule(profileBundle.profile.id);
  if (!schedule || schedule.slots.length === 0) {
    return { slots: [], scheduleId: null, hasActiveSchedule: false };
  }

  return {
    scheduleId: schedule.schedule.id,
    hasActiveSchedule: true,
    slots: schedule.slots
      .filter((slot) => slot.day && slot.start && slot.end)
      .map((slot) => ({
        day: slot.day,
        start: slot.start,
        end: slot.end,
        subject: slot.subject,
        hours: slot.hours,
        slotType: slot.slotType,
        subSubject: slot.subSubject ?? "",
        customText: slot.customText ?? "",
        color: slot.color ?? "",
        sourceScheduleSlotId: slot.id,
      })),
  };
}
