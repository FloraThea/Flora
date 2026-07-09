import type { CalendarSnapshot, TimetableInput } from "@/lib/programming/types";
import { scheduleEngine, type ResolvedSchoolDay } from "./ScheduleEngine";

export class WeeklyPlanner {
  planWeek(input: {
    calendar: CalendarSnapshot;
    timetable: TimetableInput;
    weekDates: string[];
  }): ResolvedSchoolDay[] {
    return input.weekDates.map((date) =>
      scheduleEngine.resolveDay(input.calendar, input.timetable, date),
    );
  }
}

export const weeklyPlanner = new WeeklyPlanner();
