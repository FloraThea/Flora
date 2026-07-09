import type { CalendarSnapshot, TimetableInput, TimetableSlot } from "@/lib/programming/types";
import { isDateOnWorkingDays } from "@/lib/profile/work-schedule";
import { getFrenchDayName, minutesBetween, normalizeDayName } from "./date-utils";

export type ResolvedSchoolDay = {
  date: string;
  dayName: string;
  periodNumber: number;
  weekNumber: number;
  isHoliday: boolean;
  isVacation: boolean;
  slots: TimetableSlot[];
};

export class ScheduleEngine {
  resolvePeriodAndWeek(calendar: CalendarSnapshot, date: string): {
    periodNumber: number;
    weekNumber: number;
  } {
    const target = new Date(`${date}T12:00:00`);

    for (const period of calendar.periods) {
      const start = new Date(`${period.startDate}T00:00:00`);
      const end = new Date(`${period.endDate}T23:59:59`);
      if (target < start || target > end) continue;

      const diffDays = Math.floor((target.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      const maxWeeks = period.classWeeks ?? period.workingWeeks;
      const weekNumber = Math.min(Math.max(1, Math.floor(diffDays / 7) + 1), maxWeeks);
      return { periodNumber: period.periodNumber, weekNumber };
    }

    return { periodNumber: 1, weekNumber: 1 };
  }

  isNonWorkingDay(
    calendar: CalendarSnapshot,
    date: string,
    teacherWorkingDays?: string[],
  ): boolean {
    if (teacherWorkingDays && teacherWorkingDays.length > 0 && !isDateOnWorkingDays(teacherWorkingDays, date)) {
      return true;
    }

    const target = new Date(`${date}T12:00:00`);
    const iso = date;

    if (calendar.vacations.some((vacation) => iso >= vacation.start && iso <= vacation.end)) {
      return true;
    }

    if (
      calendar.publicHolidays.some((holiday) => holiday.date === iso) ||
      calendar.bridgeDays.some((holiday) => holiday.date === iso)
    ) {
      return true;
    }

    if (teacherWorkingDays && teacherWorkingDays.length > 0) {
      return false;
    }

    const day = target.getDay();
    return day === 0 || day === 6;
  }

  getDaySlots(timetable: TimetableInput, date: string): TimetableSlot[] {
    const dayName = normalizeDayName(getFrenchDayName(date));
    return timetable.slots
      .filter((slot) => normalizeDayName(slot.day) === dayName)
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  resolveDay(
    calendar: CalendarSnapshot,
    timetable: TimetableInput,
    date: string,
    teacherWorkingDays?: string[],
  ): ResolvedSchoolDay {
    const { periodNumber, weekNumber } = this.resolvePeriodAndWeek(calendar, date);
    const isVacation = calendar.vacations.some(
      (vacation) => date >= vacation.start && date <= vacation.end,
    );
    const isHoliday =
      calendar.publicHolidays.some((holiday) => holiday.date === date) ||
      calendar.bridgeDays.some((holiday) => holiday.date === date);

    const isTeacherOff =
      teacherWorkingDays &&
      teacherWorkingDays.length > 0 &&
      !isDateOnWorkingDays(teacherWorkingDays, date);

    return {
      date,
      dayName: getFrenchDayName(date),
      periodNumber,
      weekNumber,
      isHoliday,
      isVacation,
      slots: isTeacherOff ? [] : this.getDaySlots(timetable, date),
    };
  }

  estimateSlotMinutes(slot: TimetableSlot): number {
    const fromRange = minutesBetween(slot.start, slot.end);
    if (fromRange > 0) return fromRange;
    return Math.round((slot.hours || 1) * 60);
  }
}

export const scheduleEngine = new ScheduleEngine();
