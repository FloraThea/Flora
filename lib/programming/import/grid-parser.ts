import type {
  ImportedProgrammationRow,
  ParsedProgrammationImport,
  ProgrammationColumnField,
} from "./types";
import {
  dayOfWeekFromIsoDate,
  detectDateContradiction,
  extractSchoolYearFromText,
  forwardFillGridRows,
  parseCalendarDateCell,
  parseFrenchDayOfWeek,
  parsePartialFrenchDate,
  parseSequenceSeanceCell,
} from "./spreadsheet-deterministic";

export const COLUMN_FIELD_LABELS: Record<ProgrammationColumnField, string> = {
  period: "Période",
  week: "Semaine",
  date: "Date",
  day: "Jour",
  discipline: "Discipline / Matière",
  niveau: "Niveau",
  sequence: "Séquence",
  seance: "Séance",
  objectif: "Objectif",
  competence: "Compétence",
  notion: "Notion",
  materiel: "Matériel",
  ressource: "Ressource",
  remarques: "Remarques",
  deroulement: "Déroulement",
  evaluation: "Évaluation",
  differenciation: "Différenciation",
  domaine: "Domaine",
};

export function buildPreviewText(headers: string[], rows: string[][]): string {
  if (headers.length === 0 && rows.length === 0) {
    return "Aucune donnée tabulaire détectée dans la feuille Excel.";
  }

  const headerLine = headers.length > 0 ? headers.join(" | ") : rows[0]?.join(" | ") ?? "";
  const body = (headers.length > 0 ? rows : rows.slice(1))
    .slice(0, 8)
    .map((row) => row.join(" | "))
    .join("\n");

  return body ? `${headerLine}\n${body}` : headerLine;
}

const MAPPABLE_FIELDS: ProgrammationColumnField[] = [
  "period",
  "week",
  "date",
  "day",
  "discipline",
  "niveau",
  "sequence",
  "seance",
  "objectif",
  "competence",
  "notion",
  "materiel",
  "ressource",
  "remarques",
  "deroulement",
  "evaluation",
  "differenciation",
  "domaine",
];

function splitList(value: string): string[] {
  return value
    .split(/[;|,]|(?:\s+et\s+)/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePeriodWeek(text: string): { period: number | null; week: number | null } {
  const periodMatch = text.match(/(?:p[ée]riode|p)\s*(\d+)/i);
  const weekMatch = text.match(/(?:semaine|s)\s*(\d+)/i);
  return {
    period: periodMatch ? Number(periodMatch[1]) : null,
    week: weekMatch ? Number(weekMatch[1]) : null,
  };
}

export function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function detectDelimiter(headerLine: string): string {
  if (headerLine.includes("\t")) return "\t";
  if (headerLine.split(";").length > headerLine.split(",").length) return ";";
  return ",";
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");
}

export function mapHeaderIndex(headers: string[]): Partial<Record<ProgrammationColumnField, number>> {
  const index: Partial<Record<ProgrammationColumnField, number>> = {};

  headers.forEach((header, position) => {
    const normalized = normalizeHeader(header);

    if (normalized.includes("periode") || normalized === "p") index.period = position;
    if (normalized.includes("semaine") || normalized.includes("week")) index.week = position;
    if (normalized.includes("date")) index.date = position;
    if (normalized.includes("jour") || normalized.includes("day")) index.day = position;
    if (normalized.includes("discipline") || normalized.includes("matiere")) index.discipline = position;
    if (normalized.includes("niveau") || normalized.includes("classe")) index.niveau = position;
    if (normalized.includes("sequence") || normalized.includes("module")) index.sequence = position;
    if (normalized.includes("seance") || normalized.includes("lecon")) index.seance = position;
    if (normalized.includes("objectif") || normalized.includes("oeuvre") || normalized.includes("theme")) {
      index.objectif = position;
    }
    if (normalized.includes("artiste") || normalized.includes("auteur")) index.remarques = position;
    if (normalized.includes("epoque") || normalized.includes("mouvement")) index.domaine = position;
    if (normalized.includes("competence")) index.competence = position;
    if (normalized.includes("notion")) index.notion = position;
    if (normalized.includes("materiel")) index.materiel = position;
    if (normalized.includes("ressource")) index.ressource = position;
    if (normalized.includes("remarque")) index.remarques = position;
    if (normalized.includes("deroulement")) index.deroulement = position;
    if (normalized.includes("evaluation")) index.evaluation = position;
    if (normalized.includes("differenciation")) index.differenciation = position;
    if (normalized.includes("domaine")) index.domaine = position;
  });

  return index;
}

function rowFromCells(
  cells: string[],
  headerIndex: Partial<Record<ProgrammationColumnField, number>>,
  rawLine: string,
  context?: {
    sourceSheet?: string;
    sourceRowIndex?: number;
    periodNumber?: number | null;
    periodTitle?: string;
    schoolYear?: string | null;
    discipline?: string;
  },
): ImportedProgrammationRow {
  const get = (key: ProgrammationColumnField) => {
    const position = headerIndex[key];
    return position === undefined ? "" : String(cells[position] ?? "").trim();
  };

  const periodRaw = get("period");
  const weekRaw = get("week");
  const parsed = parsePeriodWeek(`${periodRaw} ${weekRaw}`);
  const weekParsed = parseSequenceSeanceCell(
    weekRaw,
    headerIndex.week !== undefined ? "week" : "unknown",
  );

  const dateRaw = get("date");
  const dayRaw = get("day");
  const schoolYear = context?.schoolYear ?? null;
  const calendarDate =
    parseCalendarDateCell(dateRaw, undefined, schoolYear) ??
    parsePartialFrenchDate(dateRaw, schoolYear);
  const dayFromCell = parseFrenchDayOfWeek(dayRaw);
  const dayFromDate = calendarDate ? dayOfWeekFromIsoDate(calendarDate) : null;
  const dayOfWeek = dayFromCell ?? dayFromDate;
  const parseNotes: string[] = [];
  const contradiction = detectDateContradiction(calendarDate, dayRaw);
  if (contradiction) parseNotes.push(contradiction);

  const seqRaw = get("sequence");
  const seanceRaw = get("seance");
  const seqParsed = parseSequenceSeanceCell(
    seqRaw,
    headerIndex.sequence !== undefined ? "sequence" : "unknown",
  );
  const seanceParsed = parseSequenceSeanceCell(
    seanceRaw,
    headerIndex.seance !== undefined ? "seance" : "unknown",
  );

  let weekNumber =
    weekParsed.weekNumber ??
    parsed.week ??
    (weekRaw && /^\d+$/.test(weekRaw) ? Number(weekRaw) : null);
  if (seqParsed.weekNumber !== null && weekNumber === null) weekNumber = seqParsed.weekNumber;
  if (seanceParsed.weekNumber !== null && weekNumber === null) {
    weekNumber = seanceParsed.weekNumber;
    parseNotes.push("S interprété comme semaine (colonne semaine absente).");
  }

  const sequence = seqParsed.sequence || get("sequence");
  const seance = seanceParsed.seance || get("seance");
  const objectif = get("objectif");
  const periodNumber =
    context?.periodNumber ??
    parsed.period ??
    (periodRaw ? Number(periodRaw.replace(/\D/g, "")) || null : null);
  const confidence = Math.max(
    weekParsed.confidence,
    seqParsed.confidence,
    seanceParsed.confidence,
    calendarDate ? 0.9 : 0.5,
  );

  return {
    id: `row-${Math.random().toString(36).slice(2, 10)}`,
    periodNumber,
    weekNumber,
    weekLabel: weekRaw || (weekNumber ? `S${weekNumber}` : ""),
    calendarDate,
    dayOfWeek,
    discipline: get("discipline") || context?.discipline || "",
    niveau: get("niveau"),
    sequence,
    seance,
    objectif,
    competences: splitList(get("competence")),
    notions: splitList(get("notion")),
    materiel: splitList(get("materiel")),
    ressources: splitList(get("ressource")),
    remarques: get("remarques"),
    deroulement: get("deroulement"),
    evaluation: get("evaluation"),
    differenciation: get("differenciation"),
    domaine: get("domaine"),
    rawLine,
    sourceSheet: context?.sourceSheet,
    sourceRowIndex: context?.sourceRowIndex,
    rawCells: [...cells],
    parseConfidence: confidence,
    parseNotes:
      parseNotes.length > 0 || context?.periodTitle
        ? [...parseNotes, ...(context?.periodTitle ? [`period:${context.periodTitle}`] : [])]
        : undefined,
  };
}

function findHeaderRow(grid: string[][]): {
  headerRowIndex: number;
  headerIndex: Partial<Record<ProgrammationColumnField, number>>;
} {
  let bestIndex = 0;
  let bestScore = 0;
  let bestHeaderIndex: Partial<Record<ProgrammationColumnField, number>> = {};

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const headerIndex = mapHeaderIndex(grid[rowIndex]);
    const score = Object.keys(headerIndex).length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = rowIndex;
      bestHeaderIndex = headerIndex;
    }
  }

  return { headerRowIndex: bestIndex, headerIndex: bestHeaderIndex };
}

function gridHasPeriodSections(grid: string[][]): boolean {
  return grid.some((row) => /p[ée]riode\s*\d+/i.test(row.join(" ")));
}

function parsePeriodBanner(row: string[]): { periodNumber: number; title: string } | null {
  const text = String(row.find((cell) => String(cell ?? "").trim()) ?? "").trim();
  const match = text.match(/p[ée]riode\s*(\d+)(?:\s*[—–-]\s*(.+))?$/i);
  if (!match) return null;
  return { periodNumber: Number(match[1]), title: (match[2] ?? "").trim() };
}

function isTableHeaderRow(row: string[]): boolean {
  const headerIndex = mapHeaderIndex(row);
  return (
    Object.keys(headerIndex).length >= 2 &&
    headerIndex.week !== undefined &&
    headerIndex.date !== undefined
  );
}

function isSkippedImportRow(row: string[]): boolean {
  const text = row.join(" ").trim();
  if (!text) return true;
  if (/^[⛔⚠]/u.test(text)) return true;
  if (/vacances|armistice|fête du travail|fin de l'année scolaire|fichier entièrement modifiable/i.test(text)) {
    return true;
  }
  if (/^p[ée]riode\s*\d+/i.test(text)) return true;
  if (isTableHeaderRow(row)) return true;
  return false;
}

function isDataRow(row: string[], headerIndex: Partial<Record<ProgrammationColumnField, number>>): boolean {
  const weekRaw =
    headerIndex.week !== undefined ? String(row[headerIndex.week] ?? "").trim() : "";
  if (/^s\d+$/i.test(weekRaw) || /semaine\s*\d+/i.test(weekRaw)) return true;

  const seanceRaw =
    headerIndex.seance !== undefined ? String(row[headerIndex.seance] ?? "").trim() : "";
  if (seanceRaw && !/^s[ée]ance$/i.test(seanceRaw)) return true;

  const dateRaw =
    headerIndex.date !== undefined ? String(row[headerIndex.date] ?? "").trim() : "";
  if (dateRaw && /\d/.test(dateRaw)) return true;

  const joined = row.map((cell) => String(cell ?? "").trim()).filter(Boolean).join(" ");
  if (/^s\d+$/i.test(joined) || /semaine\s*\d+/i.test(joined)) return true;

  const nonEmptyCount = row.filter((cell) => String(cell ?? "").trim()).length;
  return nonEmptyCount >= 3 && Boolean(weekRaw || dateRaw || seanceRaw);
}

function inferDisciplineFromGrid(grid: string[][]): string {
  const haystack = grid
    .slice(0, 5)
    .map((row) => row.join(" "))
    .join("\n");
  if (/histoire\s+des\s+arts|\bhda\b/i.test(haystack)) return "Histoire des arts";
  if (/emc|enseignement moral/i.test(haystack)) return "EMC";
  if (/fran[çc]ais/i.test(haystack)) return "Français";
  if (/math/i.test(haystack)) return "Mathématiques";
  return "";
}

function inferSchoolYearFromGrid(grid: string[][]): string | null {
  const haystack = grid
    .slice(0, 6)
    .map((row) => row.join(" "))
    .join("\n");
  return extractSchoolYearFromText(haystack);
}

function rowsFromGridWithSections(
  grid: string[][],
  columnMapping?: Partial<Record<ProgrammationColumnField, number>>,
  context?: { sourceSheet?: string },
): {
  headers: string[];
  headerRowIndex: number;
  headerIndex: Partial<Record<ProgrammationColumnField, number>>;
  rows: ImportedProgrammationRow[];
  dataRows: string[][];
} {
  const schoolYear = inferSchoolYearFromGrid(grid);
  const discipline = inferDisciplineFromGrid(grid);
  let currentPeriod: number | null = null;
  let currentPeriodTitle = "";
  let currentHeaderIndex: Partial<Record<ProgrammationColumnField, number>> =
    columnMapping && Object.keys(columnMapping).length > 0 ? columnMapping : {};
  let headerRowIndex = 0;
  let headers: string[] = [];
  const rows: ImportedProgrammationRow[] = [];
  const dataRows: string[][] = [];

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const cells = grid[rowIndex];
    if (!cells?.some((cell) => String(cell ?? "").trim())) continue;

    const banner = parsePeriodBanner(cells);
    if (banner) {
      currentPeriod = banner.periodNumber;
      currentPeriodTitle = banner.title;
      continue;
    }

    if (isTableHeaderRow(cells)) {
      currentHeaderIndex =
        columnMapping && Object.keys(columnMapping).length > 0
          ? columnMapping
          : mapHeaderIndex(cells);
      headerRowIndex = rowIndex;
      headers = [...cells];
      continue;
    }

    if (Object.keys(currentHeaderIndex).length < 2) continue;
    if (!isDataRow(cells, currentHeaderIndex)) continue;
    if (isSkippedImportRow(cells)) continue;

    dataRows.push(cells);
    rows.push(
      rowFromCells(cells, currentHeaderIndex, cells.join(" | "), {
        sourceSheet: context?.sourceSheet,
        sourceRowIndex: rowIndex,
        periodNumber: currentPeriod,
        periodTitle: currentPeriodTitle,
        schoolYear,
        discipline,
      }),
    );
  }

  return { headers, headerRowIndex, headerIndex: currentHeaderIndex, rows, dataRows };
}

export function rowsFromGrid(
  grid: string[][],
  columnMapping?: Partial<Record<ProgrammationColumnField, number>>,
  context?: { sourceSheet?: string },
): {
  headers: string[];
  headerRowIndex: number;
  headerIndex: Partial<Record<ProgrammationColumnField, number>>;
  rows: ImportedProgrammationRow[];
  dataRows: string[][];
} {
  if (grid.length === 0) {
    return {
      headers: [],
      headerRowIndex: 0,
      headerIndex: {},
      rows: [],
      dataRows: [],
    };
  }

  const filledGrid = gridHasPeriodSections(grid) ? grid : forwardFillGridRows(grid);

  if (gridHasPeriodSections(filledGrid)) {
    return rowsFromGridWithSections(filledGrid, columnMapping, context);
  }

  const { headerRowIndex, headerIndex: detectedIndex } = findHeaderRow(filledGrid);
  const headers = filledGrid[headerRowIndex] ?? [];
  const headerIndex =
    columnMapping && Object.keys(columnMapping).length > 0 ? columnMapping : detectedIndex;
  const hasHeader = Object.keys(headerIndex).length >= 2;
  const dataRows = hasHeader ? filledGrid.slice(headerRowIndex + 1) : filledGrid;
  const rows: ImportedProgrammationRow[] = [];

  for (let rowOffset = 0; rowOffset < dataRows.length; rowOffset += 1) {
    const cells = dataRows[rowOffset];
    if (cells.every((cell) => !String(cell ?? "").trim())) continue;

    if (hasHeader) {
      rows.push(
        rowFromCells(cells, headerIndex, cells.join(" | "), {
          sourceSheet: context?.sourceSheet,
          sourceRowIndex: headerRowIndex + 1 + rowOffset,
        }),
      );
      continue;
    }

    const joined = cells.join(" ");
    const { period, week } = parsePeriodWeek(joined);
    rows.push({
      id: `row-${Math.random().toString(36).slice(2, 10)}`,
      periodNumber: period,
      weekNumber: week,
      weekLabel: week ? `S${week}` : "",
      calendarDate: null,
      dayOfWeek: null,
      discipline: cells[0] ?? "",
      niveau: "",
      sequence: "",
      seance: cells[1] ?? cells[0] ?? "",
      objectif: cells[2] ?? "",
      competences: splitList(cells[3] ?? ""),
      notions: splitList(cells[4] ?? ""),
      materiel: splitList(cells[5] ?? ""),
      ressources: splitList(cells[6] ?? ""),
      remarques: cells[7] ?? "",
      deroulement: "",
      evaluation: "",
      differenciation: "",
      domaine: "",
      rawLine: cells.join(" | "),
      sourceSheet: context?.sourceSheet,
      sourceRowIndex: headerRowIndex + 1 + rowOffset,
      rawCells: [...cells],
    });
  }

  return { headers, headerRowIndex, headerIndex, rows, dataRows };
}

export function parseStructuredText(text: string): ImportedProgrammationRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const grid = lines.map((line) => parseCsvLine(line, delimiter));
  return rowsFromGrid(grid).rows;
}

export function inferDiscipline(rows: ImportedProgrammationRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.discipline) continue;
    counts.set(row.discipline, (counts.get(row.discipline) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "";
}

export function inferNiveau(rows: ImportedProgrammationRow[]): string {
  for (const row of rows) {
    if (row.niveau) return row.niveau;
  }
  return "";
}

export function buildDetectedFields(
  rows: ImportedProgrammationRow[],
  headerIndex: Partial<Record<ProgrammationColumnField, number>>,
  headers: string[],
): Partial<Record<ProgrammationColumnField, string>> {
  const detected: Partial<Record<ProgrammationColumnField, string>> = {};

  for (const field of MAPPABLE_FIELDS) {
    const columnIndex = headerIndex[field];
    if (columnIndex !== undefined && headers[columnIndex]) {
      detected[field] = headers[columnIndex];
      continue;
    }

    const sample = rows.find((row) => {
      switch (field) {
        case "period":
          return row.periodNumber !== null;
        case "week":
          return row.weekNumber !== null;
        case "discipline":
          return Boolean(row.discipline);
        case "niveau":
          return Boolean(row.niveau);
        case "sequence":
          return Boolean(row.sequence);
        case "seance":
          return Boolean(row.seance);
        case "objectif":
          return Boolean(row.objectif);
        case "competence":
          return row.competences.length > 0;
        case "notion":
          return row.notions.length > 0;
        case "materiel":
          return row.materiel.length > 0;
        case "ressource":
          return row.ressources.length > 0;
        case "remarques":
          return Boolean(row.remarques);
        case "deroulement":
          return Boolean(row.deroulement);
        case "evaluation":
          return Boolean(row.evaluation);
        case "differenciation":
          return Boolean(row.differenciation);
        case "domaine":
          return Boolean(row.domaine);
        default:
          return false;
      }
    });

    if (sample) {
      detected[field] = "Détecté dans les données";
    }
  }

  return detected;
}

export function applyProgrammationColumnMapping(
  parsed: ParsedProgrammationImport,
  columnMapping: Partial<Record<ProgrammationColumnField, number>>,
): ParsedProgrammationImport {
  if (!parsed.sourceGrid || parsed.sourceGrid.length === 0) return parsed;

  const { headers, headerRowIndex, headerIndex, rows, dataRows } = rowsFromGrid(
    parsed.sourceGrid,
    columnMapping,
  );

  const needsColumnMapping = Object.keys(headerIndex).length < 2;

  return {
    ...parsed,
    rows,
    columns: headers,
    previewRows: dataRows.slice(0, 8),
    rowCount: rows.length,
    headerRowIndex,
    columnMapping,
    needsColumnMapping,
    detectedFields: buildDetectedFields(rows, headerIndex, headers),
    discipline: inferDiscipline(rows),
    niveau: inferNiveau(rows),
    extractedTextPreview: buildPreviewText(headers, dataRows),
    warnings: needsColumnMapping
      ? [
          ...parsed.warnings.filter((w) => !w.includes("correspondance des colonnes")),
          "Structure peu claire : associez manuellement les colonnes pour continuer.",
        ]
      : parsed.warnings.filter((w) => !w.includes("correspondance des colonnes")),
  };
}
