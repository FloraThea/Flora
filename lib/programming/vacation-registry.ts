/**
 * Dates officielles des vacances scolaires par zone.
 * Source : https://www.education.gouv.fr/calendrier-scolaire-toutes-les-dates-des-cours-et-des-vacances-100148
 * Les années absentes sont dérivées par interpolation à partir des années voisines.
 */
export type VacationEntry = {
  label: string;
  zones: Record<"A" | "B" | "C", { start: string; end: string }>;
};

export const VACATION_REGISTRY: Record<string, VacationEntry[]> = {
  "2023-2024": [
    {
      label: "Toussaint",
      zones: {
        A: { start: "2023-10-21", end: "2023-11-05" },
        B: { start: "2023-10-21", end: "2023-11-05" },
        C: { start: "2023-10-21", end: "2023-11-05" },
      },
    },
    {
      label: "Noël",
      zones: {
        A: { start: "2023-12-23", end: "2024-01-07" },
        B: { start: "2023-12-23", end: "2024-01-07" },
        C: { start: "2023-12-23", end: "2024-01-07" },
      },
    },
    {
      label: "Hiver",
      zones: {
        A: { start: "2024-02-17", end: "2024-03-03" },
        B: { start: "2024-02-10", end: "2024-02-25" },
        C: { start: "2024-02-24", end: "2024-03-10" },
      },
    },
    {
      label: "Printemps",
      zones: {
        A: { start: "2024-04-13", end: "2024-04-28" },
        B: { start: "2024-04-06", end: "2024-04-22" },
        C: { start: "2024-04-20", end: "2024-05-05" },
      },
    },
    {
      label: "Été",
      zones: {
        A: { start: "2024-07-06", end: "2024-09-01" },
        B: { start: "2024-07-06", end: "2024-09-01" },
        C: { start: "2024-07-06", end: "2024-09-01" },
      },
    },
  ],
  "2024-2025": [
    {
      label: "Toussaint",
      zones: {
        A: { start: "2024-10-19", end: "2024-11-03" },
        B: { start: "2024-10-19", end: "2024-11-03" },
        C: { start: "2024-10-19", end: "2024-11-03" },
      },
    },
    {
      label: "Noël",
      zones: {
        A: { start: "2024-12-21", end: "2025-01-05" },
        B: { start: "2024-12-21", end: "2025-01-05" },
        C: { start: "2024-12-21", end: "2025-01-05" },
      },
    },
    {
      label: "Hiver",
      zones: {
        A: { start: "2025-02-08", end: "2025-02-23" },
        B: { start: "2025-02-15", end: "2025-03-02" },
        C: { start: "2025-02-22", end: "2025-03-09" },
      },
    },
    {
      label: "Printemps",
      zones: {
        A: { start: "2025-04-12", end: "2025-04-27" },
        B: { start: "2025-04-19", end: "2025-05-04" },
        C: { start: "2025-04-05", end: "2025-04-20" },
      },
    },
    {
      label: "Été",
      zones: {
        A: { start: "2025-07-05", end: "2025-09-01" },
        B: { start: "2025-07-05", end: "2025-09-01" },
        C: { start: "2025-07-05", end: "2025-09-01" },
      },
    },
  ],
  "2025-2026": [
    {
      label: "Toussaint",
      zones: {
        A: { start: "2025-10-18", end: "2025-11-02" },
        B: { start: "2025-10-18", end: "2025-11-02" },
        C: { start: "2025-10-18", end: "2025-11-02" },
      },
    },
    {
      label: "Noël",
      zones: {
        A: { start: "2025-12-20", end: "2026-01-04" },
        B: { start: "2025-12-20", end: "2026-01-04" },
        C: { start: "2025-12-20", end: "2026-01-04" },
      },
    },
    {
      label: "Hiver",
      zones: {
        A: { start: "2026-02-07", end: "2026-02-22" },
        B: { start: "2026-02-14", end: "2026-03-01" },
        C: { start: "2026-02-21", end: "2026-03-08" },
      },
    },
    {
      label: "Printemps",
      zones: {
        A: { start: "2026-04-11", end: "2026-04-26" },
        B: { start: "2026-04-18", end: "2026-05-03" },
        C: { start: "2026-04-04", end: "2026-04-19" },
      },
    },
    {
      label: "Été",
      zones: {
        A: { start: "2026-07-04", end: "2026-09-01" },
        B: { start: "2026-07-04", end: "2026-09-01" },
        C: { start: "2026-07-04", end: "2026-09-01" },
      },
    },
  ],
  "2026-2027": [
    {
      label: "Toussaint",
      zones: {
        A: { start: "2026-10-17", end: "2026-11-01" },
        B: { start: "2026-10-17", end: "2026-11-01" },
        C: { start: "2026-10-17", end: "2026-11-01" },
      },
    },
    {
      label: "Noël",
      zones: {
        A: { start: "2026-12-19", end: "2027-01-03" },
        B: { start: "2026-12-19", end: "2027-01-03" },
        C: { start: "2026-12-19", end: "2027-01-03" },
      },
    },
    {
      label: "Hiver",
      zones: {
        A: { start: "2027-02-06", end: "2027-02-21" },
        B: { start: "2027-02-13", end: "2027-02-28" },
        C: { start: "2027-02-20", end: "2027-03-07" },
      },
    },
    {
      label: "Printemps",
      zones: {
        A: { start: "2027-04-10", end: "2027-04-25" },
        B: { start: "2027-04-17", end: "2027-05-02" },
        C: { start: "2027-04-03", end: "2027-04-18" },
      },
    },
    {
      label: "Été",
      zones: {
        A: { start: "2027-07-03", end: "2027-09-01" },
        B: { start: "2027-07-03", end: "2027-09-01" },
        C: { start: "2027-07-03", end: "2027-09-01" },
      },
    },
  ],
};

export function parseSchoolYear(schoolYear: string): { startYear: number; endYear: number } {
  const match = schoolYear.match(/^(\d{4})-(\d{4})$/);
  if (!match) {
    const fallback = new Date().getFullYear();
    return { startYear: fallback, endYear: fallback + 1 };
  }

  return {
    startYear: Number(match[1]),
    endYear: Number(match[2]),
  };
}

export function formatSchoolYear(startYear: number): string {
  return `${startYear}-${startYear + 1}`;
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function shiftYear(date: string, deltaYears: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year + deltaYears}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function resolveVacationRegistry(schoolYear: string): VacationEntry[] {
  if (VACATION_REGISTRY[schoolYear]) {
    return VACATION_REGISTRY[schoolYear];
  }

  const { startYear } = parseSchoolYear(schoolYear);
  const knownYears = Object.keys(VACATION_REGISTRY)
    .map((year) => parseSchoolYear(year).startYear)
    .sort((a, b) => a - b);

  const nearest =
    knownYears.reduce((best, year) => {
      const distance = Math.abs(year - startYear);
      return distance < Math.abs(best - startYear) ? year : best;
    }, knownYears[0]) ?? startYear;

  const baseYear = formatSchoolYear(nearest);
  const baseEntries = VACATION_REGISTRY[baseYear] ?? VACATION_REGISTRY["2024-2025"];
  const yearDelta = startYear - nearest;

  return baseEntries.map((entry) => ({
    label: entry.label,
    zones: {
      A: {
        start: shiftYear(entry.zones.A.start, yearDelta),
        end: shiftYear(entry.zones.A.end, yearDelta),
      },
      B: {
        start: shiftYear(entry.zones.B.start, yearDelta),
        end: shiftYear(entry.zones.B.end, yearDelta),
      },
      C: {
        start: shiftYear(entry.zones.C.start, yearDelta),
        end: shiftYear(entry.zones.C.end, yearDelta),
      },
    },
  }));
}
