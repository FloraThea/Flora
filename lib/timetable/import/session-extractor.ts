import { addMinutes } from "../time-grid";
import { getMergeAt, type MergeRegion } from "./grid-reader";
import { parseTimeCell, parseTimeRange } from "./normalize";
import {
  applySubjectMapping,
  collectUncertainMappings,
  extractLevelAndGroup,
} from "./subject-mapper";
import type {
  EmptySlotSuggestion,
  ParsedTimetableImport,
  StructureOverrides,
  TimetableImportSession,
  TimetableStructure,
} from "./types";

function suggestSubjectsForEmpty(day: string, existing: TimetableImportSession[]): string[] {
  const daySubjects = existing
    .filter((s) => s.day === day && s.subject)
    .map((s) => s.subject);
  const unique = [...new Set(daySubjects)];
  if (unique.length > 0) return unique.slice(0, 3);
  return ["Français", "Mathématiques", "Rituels"];
}

function resolveEndTime(
  grid: string[][],
  structure: TimetableStructure,
  row: number,
  startTime: string,
  rowSpan: number,
): string {
  const range = parseTimeRange(grid[row]?.[structure.timeColumn] ?? "");
  if (range?.end) return range.end;

  const nextRow = row + rowSpan;
  let scanRow = nextRow;
  while (scanRow < grid.length) {
    const nextTime = parseTimeCell(grid[scanRow]?.[structure.timeColumn] ?? "");
    if (nextTime) return nextTime;
    if (scanRow - row > rowSpan + 5) break;
    scanRow++;
  }

  const immediateNext = parseTimeCell(grid[row + 1]?.[structure.timeColumn] ?? "");
  if (immediateNext) return immediateNext;

  return addMinutes(startTime, rowSpan > 1 ? rowSpan * 30 : 60);
}

function dayColumnsInSpan(
  dayColumns: Record<string, number>,
  originCol: number,
  colSpan: number,
): Array<{ day: string; col: number }> {
  const cols = Object.entries(dayColumns)
    .map(([day, col]) => ({ day, col }))
    .filter(({ col }) => col >= originCol && col < originCol + colSpan)
    .sort((a, b) => a.col - b.col);

  if (cols.length > 0) return cols;

  const exact = Object.entries(dayColumns).find(([, col]) => col === originCol);
  if (exact) return [{ day: exact[0], col: exact[1] }];
  return [];
}

function extractSessionsDaysInRow(
  grid: string[][],
  merges: MergeRegion[],
  structure: TimetableStructure,
  overrides?: Record<string, string>,
): {
  sessions: TimetableImportSession[];
  emptySlots: EmptySlotSuggestion[];
  timeSlots: Set<string>;
} {
  const sessions: TimetableImportSession[] = [];
  const emptySlots: EmptySlotSuggestion[] = [];
  const timeSlots = new Set<string>();
  const processedOrigins = new Set<string>();

  for (let row = 0; row < grid.length; row++) {
    if (row === structure.headerRow) continue;

    const rowCells = grid[row];
    if (!rowCells) continue;

    const timeCell = rowCells[structure.timeColumn] ?? "";
    const startTime = parseTimeCell(timeCell);
    if (!startTime) continue;

    timeSlots.add(startTime);

    for (const [day, colIndex] of Object.entries(structure.dayColumns)) {
      const merge = getMergeAt(merges, row, colIndex);
      if (!merge.isOrigin) continue;

      const originKey = `${merge.region?.startRow ?? row}:${merge.region?.startCol ?? colIndex}`;
      if (processedOrigins.has(originKey)) continue;
      processedOrigins.add(originKey);

      const endTime = resolveEndTime(grid, structure, row, startTime, merge.rowSpan);
      const targets = merge.colSpan > 1
        ? dayColumnsInSpan(structure.dayColumns, colIndex, merge.colSpan)
        : [{ day, col: colIndex }];

      for (const target of targets.length > 0 ? targets : [{ day, col: colIndex }]) {
        const raw = String(rowCells[target.col] ?? "").trim();
        pushSessionOrEmpty({
          raw,
          day: target.day,
          startTime,
          endTime,
          row,
          colIndex: target.col,
          sessions,
          emptySlots,
          overrides,
        });
      }
    }
  }

  return { sessions, emptySlots, timeSlots };
}

function extractSessionsDaysInColumn(
  grid: string[][],
  merges: MergeRegion[],
  structure: TimetableStructure,
  overrides?: Record<string, string>,
): {
  sessions: TimetableImportSession[];
  emptySlots: EmptySlotSuggestion[];
  timeSlots: Set<string>;
} {
  const sessions: TimetableImportSession[] = [];
  const emptySlots: EmptySlotSuggestion[] = [];
  const timeSlots = new Set<string>();

  const timeHeaderRow = structure.timeColumn;
  const timeByCol: Record<number, string> = {};

  for (let col = structure.dayColumn + 1; col < (grid[timeHeaderRow]?.length ?? 0); col++) {
    const parsed = parseTimeCell(grid[timeHeaderRow]?.[col] ?? "");
    if (parsed) {
      timeByCol[col] = parsed;
      timeSlots.add(parsed);
    }
  }

  if (Object.keys(timeByCol).length === 0) {
    for (let col = 0; col < (grid[0]?.length ?? 0); col++) {
      const parsed = parseTimeCell(grid[timeHeaderRow]?.[col] ?? "");
      if (parsed) {
        timeByCol[col] = parsed;
        timeSlots.add(parsed);
      }
    }
  }

  const sortedTimeCols = Object.entries(timeByCol)
    .map(([col, time]) => ({ col: Number(col), time }))
    .sort((a, b) => a.col - b.col);

  for (const [day, dayRow] of Object.entries(structure.dayColumns)) {
    for (let i = 0; i < sortedTimeCols.length; i++) {
      const { col, time: startTime } = sortedTimeCols[i];
      const endTime =
        sortedTimeCols[i + 1]?.time ?? addMinutes(startTime, 60);

      const merge = getMergeAt(merges, dayRow, col);
      if (!merge.isOrigin) continue;

      const raw = String(grid[dayRow]?.[col] ?? "").trim();
      pushSessionOrEmpty({
        raw,
        day,
        startTime,
        endTime,
        row: dayRow,
        colIndex: col,
        sessions,
        emptySlots,
        overrides,
      });
    }
  }

  return { sessions, emptySlots, timeSlots };
}

function pushSessionOrEmpty(input: {
  raw: string;
  day: string;
  startTime: string;
  endTime: string;
  row: number;
  colIndex: number;
  sessions: TimetableImportSession[];
  emptySlots: EmptySlotSuggestion[];
  overrides?: Record<string, string>;
}) {
  const { raw, day, startTime, endTime, row, colIndex, sessions, emptySlots, overrides } = input;

  if (!raw) {
    emptySlots.push({
      day,
      startTime,
      endTime,
      suggestions: suggestSubjectsForEmpty(day, sessions),
    });
    return;
  }

  const { level, group, cleaned } = extractLevelAndGroup(raw);
  const mapped = applySubjectMapping(cleaned || raw, overrides);

  sessions.push({
    day,
    startTime,
    endTime,
    subject: mapped.subject,
    title: cleaned,
    level,
    group,
    location: "",
    notes: group ? `Groupe ${group}` : "",
    color: mapped.color,
    slotType: mapped.slotType,
    rawLabel: raw,
    isEmpty: false,
    rowIndex: row,
    colIndex,
  });
}

export function extractSessionsFromGrid(
  grid: string[][],
  merges: MergeRegion[],
  structure: TimetableStructure,
  overrides?: Record<string, string>,
): Pick<ParsedTimetableImport, "sessions" | "emptySlots" | "timeSlots" | "days" | "uncertainMappings"> {
  const result =
    structure.layout === "days_in_column"
      ? extractSessionsDaysInColumn(grid, merges, structure, overrides)
      : extractSessionsDaysInRow(grid, merges, structure, overrides);

  const days = Object.keys(structure.dayColumns).sort(
    (a, b) =>
      (structure.dayColumns[a] ?? 0) - (structure.dayColumns[b] ?? 0),
  );

  return {
    sessions: result.sessions,
    emptySlots: result.emptySlots,
    timeSlots: [...result.timeSlots].sort(),
    days,
    uncertainMappings: collectUncertainMappings(result.sessions),
  };
}

export function extractMetaFromGrid(grid: string[][], keywords: string[]): string {
  for (const row of grid.slice(0, 10)) {
    for (let i = 0; i < row.length - 1; i++) {
      const label = row[i]?.toLowerCase() ?? "";
      if (keywords.some((kw) => label.includes(kw))) {
        return row[i + 1]?.trim() ?? "";
      }
    }
    for (const cell of row) {
      const lower = cell.toLowerCase();
      if (keywords.some((kw) => lower.includes(kw))) {
        const parts = cell.split(/[:：]/);
        if (parts[1]?.trim()) return parts[1].trim();
      }
    }
  }
  return "";
}

export type ParseGridInput = {
  fileName: string;
  sheetName: string;
  grid: string[][];
  merges: MergeRegion[];
  structure: TimetableStructure;
  needsManualStructure: boolean;
  diagnostics: ParsedTimetableImport["diagnostics"];
  subjectOverrides?: Record<string, string>;
  structureOverrides?: StructureOverrides;
};

export function buildParsedImport(input: ParseGridInput): ParsedTimetableImport {
  const warnings: string[] = [...input.diagnostics.anomalies];

  if (input.needsManualStructure) {
    return {
      fileName: input.fileName,
      sheetName: input.sheetName,
      className: extractMetaFromGrid(input.grid, ["classe", "class"]),
      teacherName: extractMetaFromGrid(input.grid, ["enseignant", "prof", "nom"]),
      schoolYear: extractMetaFromGrid(input.grid, ["année", "annee", "202"]),
      days: [],
      timeSlots: [],
      sessions: [],
      emptySlots: [],
      uncertainMappings: [],
      warnings,
      structure: input.structure,
      needsManualStructure: true,
      diagnostics: input.diagnostics,
      gridPreview: input.grid.slice(0, 20),
    };
  }

  const extracted = extractSessionsFromGrid(
    input.grid,
    input.merges,
    input.structure,
    input.subjectOverrides,
  );

  if (extracted.sessions.length === 0) {
    warnings.push(
      "Aucune séance détectée — ajustez la ligne des jours ou la colonne des horaires, puis relancez l'analyse.",
    );
  }

  return {
    fileName: input.fileName,
    sheetName: input.sheetName,
    className: extractMetaFromGrid(input.grid, ["classe", "class"]),
    teacherName: extractMetaFromGrid(input.grid, ["enseignant", "prof", "nom"]),
    schoolYear: extractMetaFromGrid(input.grid, ["année", "annee", "202"]),
    days: extracted.days,
    timeSlots: extracted.timeSlots,
    sessions: extracted.sessions,
    emptySlots: extracted.emptySlots,
    uncertainMappings: extracted.uncertainMappings,
    warnings,
    structure: input.structure,
    needsManualStructure: false,
    diagnostics: input.diagnostics,
    gridPreview: input.grid.slice(0, 20),
  };
}
