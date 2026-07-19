import {
  parseCalendarDateCell,
  parsePartialFrenchDate,
} from "@/lib/programming/import/spreadsheet-deterministic";
import type { ParsedProgrammationRow } from "@/lib/programming/import/types";

export type SpreadsheetComparisonStatus =
  | "identique"
  | "transformée_correctement"
  | "incorrecte"
  | "perdue";

export type SpreadsheetRowComparison = {
  sourceRowIndex: number;
  weekSource: string;
  dateSource: string;
  dateExpected: string | null;
  dateInterpreted: string | null;
  dayExpected: string | null;
  dayInterpreted: string | null;
  periodExpected: number | null;
  periodInterpreted: number | null;
  weekExpected: number | null;
  weekInterpreted: number | null;
  domaineSource: string;
  domaineInterpreted: string;
  seanceSource: string;
  seanceInterpreted: string;
  objectifSource: string;
  objectifInterpreted: string;
  artisteSource: string;
  artisteInterpreted: string;
  status: SpreadsheetComparisonStatus;
  notes: string[];
};

export type SpreadsheetCompareProfile = "programmation_hda" | "progression_emc";

function detectCurrentPeriod(joined: string): number | null {
  const match = joined.match(/p[ée]riode\s*(\d+)/i);
  if (!match) return null;
  if (/^p[ée]riode\s*\d+\s*$/i.test(joined.replace(/\s+/g, " ").trim())) {
    return Number(match[1]);
  }
  if (/[—–-]/.test(joined)) return Number(match[1]);
  return Number(match[1]);
}

function dayFromIso(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long" });
}

export function compareSpreadsheetRows(
  grid: string[][],
  parsedRows: ParsedProgrammationRow[],
  schoolYear: string | null,
  profile: SpreadsheetCompareProfile,
): SpreadsheetRowComparison[] {
  const comparisons: SpreadsheetRowComparison[] = [];
  let currentPeriod: number | null = null;

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];
    const joined = row.join(" ").trim();
    const periodDetected = detectCurrentPeriod(joined);
    if (periodDetected !== null && /p[ée]riode/i.test(joined)) {
      currentPeriod = periodDetected;
      continue;
    }
    if (!/^s\d+$/i.test(String(row[0] ?? "").trim())) continue;

    const parsed = parsedRows.find((item) => item.sourceRowIndex === rowIndex);
    const weekSource = String(row[0] ?? "").trim();
    const dateSource = String(row[1] ?? "").trim();
    const weekExpected = Number(weekSource.match(/\d+/)?.[0] ?? NaN) || null;
    const dateExpected =
      parseCalendarDateCell(dateSource, undefined, schoolYear) ??
      parsePartialFrenchDate(dateSource, schoolYear);

    const domaineSource = profile === "progression_emc" ? String(row[2] ?? "").trim() : String(row[4] ?? "").trim();
    const seanceSource = profile === "progression_emc" ? String(row[3] ?? "").trim() : "";
    const objectifSource = profile === "programmation_hda" ? String(row[2] ?? "").trim() : "";
    const artisteSource = profile === "programmation_hda" ? String(row[3] ?? "").trim() : "";

    const notes: string[] = [];
    let status: SpreadsheetComparisonStatus = "identique";

    if (!parsed) {
      comparisons.push({
        sourceRowIndex: rowIndex,
        weekSource,
        dateSource,
        dateExpected,
        dateInterpreted: null,
        dayExpected: dayFromIso(dateExpected),
        dayInterpreted: null,
        periodExpected: currentPeriod,
        periodInterpreted: null,
        weekExpected,
        weekInterpreted: null,
        domaineSource,
        domaineInterpreted: "",
        seanceSource,
        seanceInterpreted: "",
        objectifSource,
        objectifInterpreted: "",
        artisteSource,
        artisteInterpreted: "",
        status: "perdue",
        notes: ["Ligne source non importée"],
      });
      continue;
    }

    if (parsed.calendarDate !== dateExpected) {
      status = "incorrecte";
      notes.push(`Date: source=${dateExpected} interprétée=${parsed.calendarDate}`);
    }
    if (parsed.periodNumber !== currentPeriod) {
      status = "incorrecte";
      notes.push(`Période: source=${currentPeriod} interprétée=${parsed.periodNumber}`);
    }
    if (parsed.weekNumber !== weekExpected) {
      status = "incorrecte";
      notes.push(`Semaine: source=${weekExpected} interprétée=${parsed.weekNumber}`);
    }

    if (profile === "progression_emc") {
      if (parsed.domaine !== domaineSource) {
        status = "incorrecte";
        notes.push(`Domaine: source=${domaineSource} interprétée=${parsed.domaine}`);
      }
      if (parsed.seance !== seanceSource) {
        status = "incorrecte";
        notes.push(`Séance: source=${seanceSource} interprétée=${parsed.seance}`);
      }
    } else {
      if (parsed.objectif !== objectifSource) {
        status = "incorrecte";
        notes.push(`Œuvre: source=${objectifSource} interprétée=${parsed.objectif}`);
      }
      if (parsed.remarques !== artisteSource) {
        status = status === "identique" ? "transformée_correctement" : status;
        notes.push(`Artiste: source=${artisteSource} interprétée=${parsed.remarques}`);
      }
      if (domaineSource && parsed.domaine !== domaineSource) {
        status = "incorrecte";
        notes.push(`Domaine: source=${domaineSource} interprétée=${parsed.domaine}`);
      }
    }

    comparisons.push({
      sourceRowIndex: rowIndex,
      weekSource,
      dateSource,
      dateExpected,
      dateInterpreted: parsed.calendarDate,
      dayExpected: parsed.dayOfWeek ?? dayFromIso(dateExpected),
      dayInterpreted: parsed.dayOfWeek,
      periodExpected: currentPeriod,
      periodInterpreted: parsed.periodNumber,
      weekExpected,
      weekInterpreted: parsed.weekNumber,
      domaineSource,
      domaineInterpreted: parsed.domaine,
      seanceSource,
      seanceInterpreted: parsed.seance,
      objectifSource,
      objectifInterpreted: parsed.objectif,
      artisteSource,
      artisteInterpreted: parsed.remarques,
      status,
      notes,
    });
  }

  return comparisons;
}
