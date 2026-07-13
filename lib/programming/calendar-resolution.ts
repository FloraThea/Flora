import type { CalendarSnapshot } from "@/lib/programming/types";

export function resolvePeriodAndWeekFromCalendar(
  calendar: CalendarSnapshot,
  date: string,
): { periodNumber: number; weekNumber: number } {
  const match = calendar.schoolWeeks.find(
    (week) => date >= week.startDate && date <= week.endDate,
  );

  if (match) {
    const period = calendar.periods.find((item) =>
      item.schoolWeeks.some((week) => week.weekNumberInYear === match.weekNumberInYear),
    );
    return {
      periodNumber: period?.periodNumber ?? 1,
      weekNumber: match.weekNumberInPeriod,
    };
  }

  for (const period of calendar.periods) {
    if (date >= period.startDate && date <= period.endDate) {
      return { periodNumber: period.periodNumber, weekNumber: 1 };
    }
  }

  return { periodNumber: 1, weekNumber: 1 };
}
