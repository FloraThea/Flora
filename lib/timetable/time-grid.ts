import { minutesBetween } from "@/lib/journal/date-utils";
import type { SmartTimetableSlot, TimetableSettings } from "./types";

export type TimeWindow = {
  day: string;
  start: string;
  end: string;
  period: "morning" | "afternoon";
};

export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + (m || 0) + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function buildAvailableWindows(settings: TimetableSettings): TimeWindow[] {
  const windows: TimeWindow[] = [];

  for (const day of settings.schoolDays) {
    windows.push(
      ...splitPeriod(day, settings.morningStart, settings.morningEnd, "morning", settings),
      ...splitPeriod(day, settings.afternoonStart, settings.afternoonEnd, "afternoon", settings),
    );
  }

  return windows;
}

function splitPeriod(
  day: string,
  start: string,
  end: string,
  period: "morning" | "afternoon",
  settings: TimetableSettings,
): TimeWindow[] {
  const blocks: TimeWindow[] = [];
  let cursor = start;

  while (minutesBetween(cursor, end) > 0) {
    const recess = settings.recesses.find((item) => item.after === cursor);
    if (recess) {
      cursor = addMinutes(cursor, recess.durationMinutes);
      continue;
    }

    const lunchStart = settings.lunchBreak.start;
    const lunchEnd = settings.lunchBreak.end;
    if (cursor >= lunchStart && cursor < lunchEnd) {
      cursor = lunchEnd;
      continue;
    }

    const nextEnd = addMinutes(cursor, settings.defaultSessionMinutes);
    const blockEnd = minutesBetween(nextEnd, end) >= 0 ? nextEnd : end;
    if (minutesBetween(cursor, blockEnd) >= 30) {
      blocks.push({ day, start: cursor, end: blockEnd, period });
    }
    cursor = blockEnd;
  }

  return blocks;
}

export function slotsOverlap(
  a: Pick<SmartTimetableSlot, "day" | "start" | "end">,
  b: Pick<SmartTimetableSlot, "day" | "start" | "end">,
): boolean {
  if (a.day !== b.day) return false;
  return a.start < b.end && b.start < a.end;
}

export function hoursFromSlot(slot: Pick<SmartTimetableSlot, "start" | "end" | "hours">): number {
  const minutes = minutesBetween(slot.start, slot.end);
  if (minutes > 0) return Math.round((minutes / 60) * 100) / 100;
  return slot.hours || 1;
}

export function sortSlots(slots: SmartTimetableSlot[]): SmartTimetableSlot[] {
  const dayOrder = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
  return [...slots].sort((a, b) => {
    const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.start.localeCompare(b.start);
  });
}

export function isMorningSlot(start: string, settings: TimetableSettings): boolean {
  return start < settings.lunchBreak.start;
}

export function isAfternoonSlot(start: string, settings: TimetableSettings): boolean {
  return start >= settings.afternoonStart;
}
