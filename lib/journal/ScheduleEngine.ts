import type { CalendarSnapshot, TimetableInput, TimetableSlot } from "@/lib/programming/types";
import { resolvePeriodAndWeekFromCalendar } from "@/lib/programming/calendar-resolution";
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
    return resolvePeriodAndWeekFromCalendar(calendar, date);
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
