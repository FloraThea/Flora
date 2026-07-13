import type {
  AcademicZone,
  CalendarSnapshot,
  PublicHoliday,
  VacationPeriod,
} from "./types";
import {
  formatSchoolYear,
  parseSchoolYear,
  resolveVacationRegistry,
  shiftDate,
} from "./vacation-registry";
import { countClassWeeksInRange } from "./calendar-weeks";

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

/** Algorithme de Meeus/Jones/Butcher pour le dimanche de Pâques. */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function buildFixedPublicHolidays(startYear: number, endYear: number): PublicHoliday[] {
  const holidays: PublicHoliday[] = [];

  for (const year of [startYear, endYear]) {
    holidays.push(
      { date: `${year}-01-01`, label: "Jour de l'an" },
      { date: `${year}-05-01`, label: "Fête du Travail" },
      { date: `${year}-05-08`, label: "Victoire 1945" },
      { date: `${year}-07-14`, label: "Fête nationale" },
      { date: `${year}-08-15`, label: "Assomption" },
      { date: `${year}-11-01`, label: "Toussaint" },
      { date: `${year}-11-11`, label: "Armistice" },
      { date: `${year}-12-25`, label: "Noël" },
    );

    const easter = easterSunday(year);
    holidays.push(
      { date: formatDate(addDays(easter, 1)), label: "Lundi de Pâques" },
      { date: formatDate(addDays(easter, 39)), label: "Ascension" },
      { date: formatDate(addDays(easter, 50)), label: "Lundi de Pentecôte" },
    );
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

function detectBridgeDays(holidays: PublicHoliday[]): PublicHoliday[] {
  const bridges: PublicHoliday[] = [];

  for (const holiday of holidays) {
    const date = toDate(holiday.date);
    const day = date.getUTCDay();

    if (day === 2) {
      bridges.push({
        date: formatDate(addDays(date, -1)),
        label: `Pont (${holiday.label})`,
        isBridge: true,
      });
    }

    if (day === 4) {
      bridges.push({
        date: formatDate(addDays(date, 1)),
        label: `Pont (${holiday.label})`,
        isBridge: true,
      });
    }
  }

  return bridges;
}

function computeRentree(
  schoolYear: string,
  registry: VacationEntry[],
  zone: AcademicZone,
): string {
  const { startYear } = parseSchoolYear(schoolYear);
  const previousYear = formatSchoolYear(startYear - 1);
  const previousRegistry = resolveVacationRegistry(previousYear);
  const previousSummer = previousRegistry.find((entry) => entry.label === "Été");

  if (previousSummer) {
    return shiftDate(previousSummer.zones[zone].end, 1);
  }

  const summer = registry.find((entry) => entry.label === "Été");
  if (summer) {
    return shiftDate(summer.zones[zone].end, 1);
  }

  return `${startYear}-09-01`;
}

function computeFinAnnee(vacations: VacationEntry[], zone: AcademicZone): string {
  const summer = vacations.find((entry) => entry.label === "Été");
  if (!summer) return `${parseSchoolYear("2024-2025").endYear}-07-04`;
  return shiftDate(summer.zones[zone].start, -1);
}

type VacationEntry = ReturnType<typeof resolveVacationRegistry>[number];

export type CalendarBuildOptions = {
  includeBridgeDays?: boolean;
  teacherWorkingDays?: string[];
};

/**
 * Calcule le calendrier scolaire officiel pour une année et une zone académique.
 * Les semaines de classe suivent le cadre réglementaire (36 semaines, fériés non décomptés).
 */
export class CalendarEngine {
  buildCalendar(
    schoolYear: string,
    academicZone: AcademicZone,
    options?: CalendarBuildOptions,
  ): CalendarSnapshot {
    const { startYear, endYear } = parseSchoolYear(schoolYear);
    const registry = resolveVacationRegistry(schoolYear);

    const vacations: VacationPeriod[] = registry.map((entry) => ({
      id: entry.label.toLowerCase().replace(/\s+/g, "_"),
      label: entry.label,
      start: entry.zones[academicZone].start,
      end: entry.zones[academicZone].end,
      zone: academicZone,
    }));

    const publicHolidays = buildFixedPublicHolidays(startYear, endYear);
    const bridgeDays = options?.includeBridgeDays === false ? [] : detectBridgeDays(publicHolidays);

    const rentree = computeRentree(schoolYear, registry, academicZone);
    const finAnnee = computeFinAnnee(registry, academicZone);

    const schoolVacationRanges = vacations
      .filter((vacation) => vacation.label !== "Été")
      .map((vacation) => ({
        start: toDate(vacation.start),
        end: toDate(vacation.end),
      }));

    const midYearVacations = vacations.filter((vacation) => vacation.label !== "Été");

    const periodStarts = [rentree, ...midYearVacations.map((vacation) => shiftDate(vacation.end, 1))];
    const periodEnds = [
      ...midYearVacations.map((vacation) => shiftDate(vacation.start, -1)),
      finAnnee,
    ];

    const periods = [];
    const allSchoolWeeks = [];
    let yearWeekOffset = 0;

    for (let index = 0; index < 5; index += 1) {
      const startDate = periodStarts[index];
      const endDate = periodEnds[index];
      if (!startDate || !endDate) continue;

      const weekStats = countClassWeeksInRange(
        startDate,
        endDate,
        schoolVacationRanges,
        {
          teacherWorkingDays: options?.teacherWorkingDays,
          publicHolidays,
          bridgeDays,
          includeBridgeDays: options?.includeBridgeDays,
        },
      );

      const holidaysInPeriod = this.collectHolidaysInRange(
        startDate,
        endDate,
        publicHolidays,
        bridgeDays,
        options?.includeBridgeDays !== false,
      );

      const periodSchoolWeeks = weekStats.schoolWeeks.map((week, weekIndex) => ({
        ...week,
        weekNumberInYear: yearWeekOffset + weekIndex + 1,
      }));
      yearWeekOffset += weekStats.classWeeks;
      allSchoolWeeks.push(...periodSchoolWeeks);

      periods.push({
        periodNumber: index + 1,
        label: `Période ${index + 1}`,
        startDate,
        endDate,
        workingWeeks: weekStats.classWeeks,
        classWeeks: weekStats.classWeeks,
        workingDays: weekStats.schoolWeeks.reduce(
          (sum, week) => sum + week.classDaysInWeek,
          0,
        ),
        effectiveWorkingDays: weekStats.effectiveWorkingDays,
        partialWeeks: weekStats.partialWeeks,
        publicHolidays: holidaysInPeriod,
        schoolWeeks: periodSchoolWeeks,
      });
    }

    const totalClassWeeks = periods.reduce((sum, period) => sum + period.classWeeks, 0);
    const totalEffectiveWorkingDays = periods.reduce(
      (sum, period) => sum + period.effectiveWorkingDays,
      0,
    );
    const totalPartialWeeks = periods.reduce((sum, period) => sum + period.partialWeeks, 0);

    return {
      schoolYear,
      academicZone,
      rentree,
      finAnnee,
      vacations,
      publicHolidays,
      bridgeDays,
      periods: periods.slice(0, 5),
      totalClassWeeks,
      totalWorkingWeeks: totalClassWeeks,
      totalEffectiveWorkingDays,
      totalPartialWeeks,
      schoolWeeks: allSchoolWeeks,
      teacherWorkingDays:
        options?.teacherWorkingDays?.length
          ? options.teacherWorkingDays
          : ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"],
    };
  }

  private collectHolidaysInRange(
    startDate: string,
    endDate: string,
    publicHolidays: PublicHoliday[],
    bridgeDays: PublicHoliday[],
    includeBridgeDays: boolean,
  ): PublicHoliday[] {
    const start = toDate(startDate);
    const end = toDate(endDate);
    const items = includeBridgeDays
      ? [...publicHolidays, ...bridgeDays]
      : [...publicHolidays];

    return items.filter((item) => {
      const date = toDate(item.date);
      return date >= start && date <= end;
    });
  }
}

export const calendarEngine = new CalendarEngine();
