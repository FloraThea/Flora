import { sortSlots } from "./time-grid";
import { BREAK_SLOT_TYPES } from "./schedule-grid-layout";
import type { SmartTimetableSlot, TimetableSettings } from "./types";
import { SCHOOL_DAYS } from "./types";

export const MOBILE_SCHEDULE_DAY_KEY = "flora-edt-mobile-day";

export type MobileDaySummary = {
  day: string;
  slotCount: number;
  startTime: string | null;
  endTime: string | null;
  isWorkingDay: boolean;
};

export function isMobileBreakSlot(slot: Pick<SmartTimetableSlot, "slotType">): boolean {
  return BREAK_SLOT_TYPES.has(slot.slotType);
}

export function getMobileScheduleDays(settings: TimetableSettings): string[] {
  return settings.schoolDays.length > 0 ? settings.schoolDays : [...SCHOOL_DAYS];
}

export function getSlotsForDay(slots: SmartTimetableSlot[], day: string): SmartTimetableSlot[] {
  return sortSlots(slots.filter((slot) => slot.day === day));
}

export function buildMobileDaySummaries(
  slots: SmartTimetableSlot[],
  settings: TimetableSettings,
): MobileDaySummary[] {
  const days = getMobileScheduleDays(settings);

  return days.map((day) => {
    const daySlots = getSlotsForDay(slots, day);
    if (daySlots.length === 0) {
      return {
        day,
        slotCount: 0,
        startTime: null,
        endTime: null,
        isWorkingDay: true,
      };
    }

    const sorted = [...daySlots].sort((a, b) => a.start.localeCompare(b.start));
    const endTimes = [...daySlots].sort((a, b) => a.end.localeCompare(b.end));
    return {
      day,
      slotCount: daySlots.length,
      startTime: sorted[0]?.start ?? null,
      endTime: endTimes[endTimes.length - 1]?.end ?? null,
      isWorkingDay: true,
    };
  });
}

export function resolveInitialMobileDay(
  days: string[],
  storedDay: string | null,
  todayDayName?: string,
): string {
  if (storedDay && days.includes(storedDay)) return storedDay;
  if (todayDayName && days.includes(todayDayName)) return todayDayName;
  return days[0] ?? "Lundi";
}

export function adjacentMobileDay(days: string[], current: string, direction: -1 | 1): string {
  const index = days.indexOf(current);
  if (index < 0) return days[0] ?? current;
  const nextIndex = Math.max(0, Math.min(days.length - 1, index + direction));
  return days[nextIndex] ?? current;
}

export function formatMobileTimeLabel(time: string): string {
  return time.replace(":", " h ");
}

export function mobileScheduleContainerClassName(): string {
  return "mobile-schedule-root w-full max-w-full overflow-x-hidden";
}
