import type { PublicHoliday, SchoolWeek } from "./types";

function toDate(value: string): Date {
  return new Date(`${value}T12:00:00.000Z`);
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isBetween(value: Date, start: Date, end: Date): boolean {
  return value >= start && value <= end;
}

/** Lundi de la semaine calendaire contenant la date. */
export function mondayOfWeek(date: Date): Date {
  const cursor = new Date(date);
  const day = cursor.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  cursor.setUTCDate(cursor.getUTCDate() + offset);
  return cursor;
}

const FRENCH_DAY_INDEX: Record<number, string> = {
  0: "dimanche",
  1: "lundi",
  2: "mardi",
  3: "mercredi",
  4: "jeudi",
  5: "vendredi",
  6: "samedi",
};

function normalizeDay(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export type ClassWeekCountOptions = {
  teacherWorkingDays?: string[];
  publicHolidays?: PublicHoliday[];
  bridgeDays?: PublicHoliday[];
  includeBridgeDays?: boolean;
};

/**
 * Compte les semaines de classe selon le cadre officiel :
 * une semaine compte si elle comporte au moins un jour de classe hors vacances.
 * Les jours fériés ne réduisent pas le nombre de semaines (Code de l'éducation).
 */
export function countClassWeeksInRange(
  startDate: string,
  endDate: string,
  schoolVacationRanges: Array<{ start: Date; end: Date }>,
  options?: ClassWeekCountOptions,
): {
  classWeeks: number;
  schoolWeeks: SchoolWeek[];
  effectiveWorkingDays: number;
  partialWeeks: number;
} {
  const periodStart = toDate(startDate);
  const periodEnd = toDate(endDate);
  const teacherDays = new Set(
    (options?.teacherWorkingDays?.length
      ? options.teacherWorkingDays
      : ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"]
    ).map((day) => normalizeDay(day)),
  );

  const nonWorkingHolidaySet = new Set<string>();
  for (const holiday of options?.publicHolidays ?? []) {
    nonWorkingHolidaySet.add(holiday.date);
  }
  if (options?.includeBridgeDays !== false) {
    for (const bridge of options?.bridgeDays ?? []) {
      nonWorkingHolidaySet.add(bridge.date);
    }
  }

  const schoolWeeks: SchoolWeek[] = [];
  let effectiveWorkingDays = 0;
  let partialWeeks = 0;
  let weekNumberInYear = 0;

  let cursor = mondayOfWeek(periodStart);

  while (cursor <= periodEnd) {
    const friday = addDays(cursor, 4);
    let hasClassDay = false;
    let daysInWeek = 0;
    let teacherDaysInWeek = 0;
    const holidaysInWeek: PublicHoliday[] = [];

    for (let offset = 0; offset < 5; offset += 1) {
      const day = addDays(cursor, offset);
      if (day < periodStart || day > periodEnd) continue;

      const inVacation = schoolVacationRanges.some((range) =>
        isBetween(day, range.start, range.end),
      );
      if (inVacation) continue;

      hasClassDay = true;
      daysInWeek += 1;

      const iso = formatDate(day);
      const dayName = FRENCH_DAY_INDEX[day.getUTCDay()] ?? "";
      const isTeacherDay = teacherDays.has(normalizeDay(dayName));

      const holiday =
        (options?.publicHolidays ?? []).find((item) => item.date === iso) ??
        (options?.bridgeDays ?? []).find((item) => item.date === iso);

      if (holiday) {
        holidaysInWeek.push(holiday);
      }

      if (isTeacherDay && !nonWorkingHolidaySet.has(iso)) {
        teacherDaysInWeek += 1;
        effectiveWorkingDays += 1;
      }
    }

    if (hasClassDay) {
      weekNumberInYear += 1;
      const isPartial =
        cursor < periodStart ||
        friday > periodEnd ||
        daysInWeek < 5 ||
        teacherDaysInWeek < teacherDays.size;

      if (isPartial) partialWeeks += 1;

      schoolWeeks.push({
        weekNumberInPeriod: schoolWeeks.length + 1,
        weekNumberInYear,
        startDate: formatDate(cursor < periodStart ? periodStart : cursor),
        endDate: formatDate(friday > periodEnd ? periodEnd : friday),
        classDaysInWeek: daysInWeek,
        teacherWorkingDaysInWeek: teacherDaysInWeek,
        isPartial,
        publicHolidays: holidaysInWeek,
      });
    }

    cursor = addDays(cursor, 7);
  }

  return {
    classWeeks: schoolWeeks.length,
    schoolWeeks,
    effectiveWorkingDays,
    partialWeeks,
  };
}
