import type { MergeRegion } from "./grid-reader";
import {
  findDaysInCell,
  isDecorativeCell,
  isLikelySubjectCell,
  parseTimeCell,
} from "./normalize";
import type { StructureOverrides, TimetableImportDiagnostics, TimetableStructure } from "./types";

const SCAN_ROWS = 20;
const SCAN_COLS = 40;

export type LayoutKind = "days_in_row" | "days_in_column";

export type StructureCandidate = {
  row: number;
  score: number;
  days: Record<string, number>;
};

export type TimeColumnCandidate = {
  col: number;
  score: number;
  sampleTimes: string[];
};

export type DetectionResult = {
  structure: TimetableStructure;
  confidence: number;
  needsManualStructure: boolean;
  diagnostics: TimetableImportDiagnostics;
};

function scanDayRows(grid: string[][]): StructureCandidate[] {
  const candidates: StructureCandidate[] = [];
  const maxRow = Math.min(grid.length, SCAN_ROWS);

  for (let row = 0; row < maxRow; row++) {
    const cells = grid[row] ?? [];
    const days: Record<string, number> = {};

    cells.forEach((cell, colIndex) => {
      for (const { day } of findDaysInCell(cell)) {
        if (!(day in days)) days[day] = colIndex;
      }
    });

    const score = Object.keys(days).length;
    if (score > 0) candidates.push({ row, score, days });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scanDayColumns(grid: string[][]): StructureCandidate[] {
  const candidates: StructureCandidate[] = [];
  const colCount = Math.max(...grid.map((row) => row.length), 0);
  const maxCol = Math.min(colCount, SCAN_COLS);

  for (let col = 0; col < maxCol; col++) {
    const days: Record<string, number> = {};
    const maxRow = Math.min(grid.length, SCAN_ROWS + 30);

    for (let row = 0; row < maxRow; row++) {
      const cell = grid[row]?.[col] ?? "";
      for (const { day } of findDaysInCell(cell)) {
        if (!(day in days)) days[day] = row;
      }
    }

    const score = Object.keys(days).length;
    if (score > 0) candidates.push({ row: col, score, days });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scanTimeColumns(
  grid: string[][],
  startRow: number,
  endRow: number,
  skipRow = -1,
): TimeColumnCandidate[] {
  const colCount = Math.max(...grid.map((row) => row.length), 0);
  const candidates: TimeColumnCandidate[] = [];

  for (let col = 0; col < Math.min(colCount, SCAN_COLS); col++) {
    const sampleTimes: string[] = [];
    let score = 0;

    for (let row = startRow; row <= endRow; row++) {
      if (row === skipRow) continue;
      const parsed = parseTimeCell(grid[row]?.[col] ?? "");
      if (parsed) {
        score++;
        if (sampleTimes.length < 5) sampleTimes.push(parsed);
      }
    }

    if (score > 0) candidates.push({ col, score, sampleTimes });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function scanTimeRows(
  grid: string[][],
  startCol: number,
  endCol: number,
): TimeColumnCandidate[] {
  const candidates: TimeColumnCandidate[] = [];

  for (let row = 0; row < Math.min(grid.length, SCAN_ROWS + 30); row++) {
    const sampleTimes: string[] = [];
    let score = 0;

    for (let col = startCol; col <= endCol; col++) {
      const parsed = parseTimeCell(grid[row]?.[col] ?? "");
      if (parsed) {
        score++;
        if (sampleTimes.length < 5) sampleTimes.push(parsed);
      }
    }

    if (score > 0) candidates.push({ col: row, score, sampleTimes });
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function countMergedRegions(merges: MergeRegion[]): number {
  return merges.length;
}

function detectSubjects(grid: string[][], structure: TimetableStructure): string[] {
  const subjects = new Set<string>();

  if (structure.layout === "days_in_row" && structure.headerRow >= 0) {
    for (let row = structure.headerRow + 1; row < grid.length; row++) {
      for (const col of Object.values(structure.dayColumns)) {
        const cell = grid[row]?.[col] ?? "";
        if (isLikelySubjectCell(cell)) subjects.add(cell.trim());
      }
    }
  }

  if (structure.layout === "days_in_column" && structure.dayColumn >= 0) {
    for (let row = structure.headerRow + 1; row < grid.length; row++) {
      for (let col = structure.timeColumn + 1; col < (grid[row]?.length ?? 0); col++) {
        const cell = grid[row]?.[col] ?? "";
        if (isLikelySubjectCell(cell)) subjects.add(cell.trim());
      }
    }
  }

  return [...subjects].slice(0, 30);
}

function findDecorativeRows(grid: string[][], headerRow: number): number[] {
  const decorative: number[] = [];
  for (let row = 0; row < Math.min(headerRow, SCAN_ROWS); row++) {
    const cells = grid[row] ?? [];
    const nonEmpty = cells.filter((c) => String(c).trim());
    if (nonEmpty.length === 0) continue;
    if (nonEmpty.every((cell) => isDecorativeCell(cell))) decorative.push(row);
  }
  return decorative;
}

export function detectStructure(
  grid: string[][],
  merges: MergeRegion[],
  overrides?: StructureOverrides,
): DetectionResult {
  const anomalies: string[] = [];
  const dayRowCandidates = scanDayRows(grid);
  const dayColumnCandidates = scanDayColumns(grid);

  let structure: TimetableStructure = {
    layout: "days_in_row",
    headerRow: -1,
    timeColumn: 0,
    dayColumn: -1,
    dayColumns: {},
    timeRows: {},
    confidence: 0,
  };

  if (overrides?.layout === "days_in_column" || overrides?.dayColumn !== undefined) {
    structure.layout = "days_in_column";
  } else if (overrides?.layout === "days_in_row" || overrides?.headerRow !== undefined) {
    structure.layout = "days_in_row";
  } else {
    const bestRow = dayRowCandidates[0];
    const bestCol = dayColumnCandidates[0];
    if ((bestCol?.score ?? 0) > (bestRow?.score ?? 0) && (bestCol?.score ?? 0) >= 2) {
      structure.layout = "days_in_column";
    } else {
      structure.layout = "days_in_row";
    }
  }

  if (structure.layout === "days_in_row") {
    const chosen =
      overrides?.headerRow !== undefined
        ? dayRowCandidates.find((c) => c.row === overrides.headerRow) ??
          buildRowCandidate(grid, overrides.headerRow)
        : dayRowCandidates[0];

    if (chosen && Object.keys(chosen.days).length > 0) {
      structure.headerRow = chosen.row;
      structure.dayColumns = chosen.days;
      structure.confidence = Math.min(1, chosen.score / 5);
    }

    const scanEnd = Math.min(grid.length - 1, SCAN_ROWS + 40);
    const timeCandidates = scanTimeColumns(grid, 0, scanEnd, structure.headerRow);

    if (overrides?.timeColumn !== undefined) {
      structure.timeColumn = overrides.timeColumn;
    } else {
      structure.timeColumn = timeCandidates[0]?.col ?? 0;
    }

    if ((timeCandidates[0]?.score ?? 0) < 2) {
      anomalies.push("Peu d'horaires détectés dans la colonne choisie — vérifiez la colonne des horaires.");
    }
  } else {
    const chosenCol =
      overrides?.dayColumn !== undefined
        ? dayColumnCandidates.find((c) => c.row === overrides.dayColumn) ??
          buildColumnCandidate(grid, overrides.dayColumn)
        : dayColumnCandidates[0];

    if (chosenCol && Object.keys(chosenCol.days).length > 0) {
      structure.dayColumn = chosenCol.row;
      structure.dayColumns = chosenCol.days;
      structure.headerRow = Math.min(...Object.values(chosenCol.days));
      structure.confidence = Math.min(1, chosenCol.score / 5);
    }

    const timeCandidates = scanTimeRows(grid, structure.dayColumn + 1, SCAN_COLS);
    if (overrides?.timeColumn !== undefined) {
      structure.timeColumn = overrides.timeColumn;
    } else {
      structure.timeColumn = timeCandidates[0]?.col ?? structure.headerRow;
    }

    if ((timeCandidates[0]?.score ?? 0) < 2) {
      anomalies.push("Peu d'horaires détectés — vérifiez la ligne ou colonne des horaires.");
    }
  }

  const needsManualStructure = Object.keys(structure.dayColumns).length === 0;

  if (needsManualStructure) {
    anomalies.push("Je n'ai pas réussi à identifier automatiquement les jours.");
  }

  const timeColumnCandidates =
    structure.layout === "days_in_row"
      ? scanTimeColumns(
          grid,
          0,
          Math.min(grid.length - 1, SCAN_ROWS + 40),
          structure.headerRow,
        )
      : scanTimeRows(grid, structure.dayColumn + 1, SCAN_COLS);

  const diagnostics: TimetableImportDiagnostics = {
    detectedDayRow: structure.layout === "days_in_row" ? structure.headerRow : null,
    detectedDayColumn: structure.layout === "days_in_column" ? structure.dayColumn : null,
    detectedTimeColumn: structure.layout === "days_in_row" ? structure.timeColumn : null,
    detectedTimeRow: structure.layout === "days_in_column" ? structure.timeColumn : null,
    layout: structure.layout,
    mergedCellCount: countMergedRegions(merges),
    detectedSubjects: needsManualStructure ? [] : detectSubjects(grid, structure),
    anomalies,
    dayRowCandidates: dayRowCandidates.slice(0, 5),
    timeColumnCandidates: timeColumnCandidates.slice(0, 5),
    decorativeRows: structure.headerRow >= 0 ? findDecorativeRows(grid, structure.headerRow) : [],
  };

  return {
    structure,
    confidence: structure.confidence,
    needsManualStructure,
    diagnostics,
  };
}

function buildRowCandidate(grid: string[][], row: number): StructureCandidate {
  const days: Record<string, number> = {};
  (grid[row] ?? []).forEach((cell, colIndex) => {
    for (const { day } of findDaysInCell(cell)) {
      if (!(day in days)) days[day] = colIndex;
    }
  });
  return { row, score: Object.keys(days).length, days };
}

function buildColumnCandidate(grid: string[][], col: number): StructureCandidate {
  const days: Record<string, number> = {};
  for (let row = 0; row < grid.length; row++) {
    for (const { day } of findDaysInCell(grid[row]?.[col] ?? "")) {
      if (!(day in days)) days[day] = row;
    }
  }
  return { row: col, score: Object.keys(days).length, days };
}
