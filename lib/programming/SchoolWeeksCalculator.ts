import type { CalendarSnapshot, SchoolPeriod } from "./types";
import { calendarEngine, type CalendarBuildOptions } from "./CalendarEngine";

/**
 * Calcule le nombre de semaines réellement travaillées par période.
 */
export class SchoolWeeksCalculator {
  calculate(
    schoolYear: string,
    academicZone: "A" | "B" | "C",
    options?: CalendarBuildOptions,
  ): CalendarSnapshot {
    return calendarEngine.buildCalendar(schoolYear, academicZone, options);
  }

  getPeriodWeekCounts(calendar: CalendarSnapshot): Record<number, number> {
    return calendar.periods.reduce<Record<number, number>>((accumulator, period) => {
      accumulator[period.periodNumber] = period.workingWeeks;
      return accumulator;
    }, {});
  }

  getPeriodByNumber(calendar: CalendarSnapshot, periodNumber: number): SchoolPeriod | undefined {
    return calendar.periods.find((period) => period.periodNumber === periodNumber);
  }
}

export const schoolWeeksCalculator = new SchoolWeeksCalculator();
