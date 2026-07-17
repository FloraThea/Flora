import type { TimetableInput, TimetableSlot } from "@/lib/programming/types";

export const EMPTY_TIMETABLE: TimetableInput = {
  slots: [],
  weeklyHoursBySubject: {},
};

function slotDurationHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const minutes = (eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0));
  return minutes > 0 ? Math.round((minutes / 60) * 100) / 100 : 0;
}

export function payloadToTimetableInput(
  slots: Array<{
    day: string;
    start: string;
    end: string;
    subject: string;
    hours?: number;
    slotType?: string;
  }>,
): TimetableInput {
  const weeklyHoursBySubject: Record<string, number> = {};
  const mappedSlots: TimetableSlot[] = [];

  for (const slot of slots) {
    if (!slot.day || !slot.start || !slot.end) continue;
    const hours = slot.hours ?? slotDurationHours(slot.start, slot.end);
    mappedSlots.push({
      day: slot.day,
      start: slot.start,
      end: slot.end,
      subject: slot.subject || "Autre",
      hours,
    });
    weeklyHoursBySubject[slot.subject || "Autre"] =
      (weeklyHoursBySubject[slot.subject || "Autre"] ?? 0) + hours;
  }

  return { slots: mappedSlots, weeklyHoursBySubject };
}
