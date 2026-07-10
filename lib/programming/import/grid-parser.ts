import type {
  ImportedProgrammationRow,
  ParsedProgrammationImport,
  ProgrammationColumnField,
} from "./types";

export const COLUMN_FIELD_LABELS: Record<ProgrammationColumnField, string> = {
  period: "Période",
  week: "Semaine",
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
    .replace(/[\u0300-\u036f]/g, "");
}

export function mapHeaderIndex(headers: string[]): Partial<Record<ProgrammationColumnField, number>> {
  const index: Partial<Record<ProgrammationColumnField, number>> = {};

  headers.forEach((header, position) => {
    const normalized = normalizeHeader(header);

    if (normalized.includes("periode") || normalized === "p") index.period = position;
    if (normalized.includes("semaine") || normalized === "s") index.week = position;
    if (normalized.includes("discipline") || normalized.includes("matiere")) index.discipline = position;
    if (normalized.includes("niveau") || normalized.includes("classe")) index.niveau = position;
    if (normalized.includes("sequence")) index.sequence = position;
    if (normalized.includes("seance")) index.seance = position;
    if (normalized.includes("objectif")) index.objectif = position;
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
): ImportedProgrammationRow {
  const get = (key: ProgrammationColumnField) => {
    const position = headerIndex[key];
    return position === undefined ? "" : String(cells[position] ?? "").trim();
  };

  const periodRaw = get("period");
  const weekRaw = get("week");
  const parsed = parsePeriodWeek(`${periodRaw} ${weekRaw}`);

  return {
    id: `row-${Math.random().toString(36).slice(2, 10)}`,
    periodNumber: parsed.period ?? (periodRaw ? Number(periodRaw) || null : null),
    weekNumber: parsed.week ?? (weekRaw ? Number(weekRaw) || null : null),
    weekLabel: weekRaw || "",
    discipline: get("discipline"),
    niveau: get("niveau"),
    sequence: get("sequence"),
    seance: get("seance") || get("objectif"),
    objectif: get("objectif"),
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
  };
}

function findHeaderRow(grid: string[][]): {
  headerRowIndex: number;
  headerIndex: Partial<Record<ProgrammationColumnField, number>>;
} {
  let bestIndex = 0;
  let bestScore = 0;
  let bestHeaderIndex: Partial<Record<ProgrammationColumnField, number>> = {};

  for (let rowIndex = 0; rowIndex < Math.min(grid.length, 8); rowIndex += 1) {
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

export function rowsFromGrid(
  grid: string[][],
  columnMapping?: Partial<Record<ProgrammationColumnField, number>>,
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

  const { headerRowIndex, headerIndex: detectedIndex } = findHeaderRow(grid);
  const headers = grid[headerRowIndex] ?? [];
  const headerIndex =
    columnMapping && Object.keys(columnMapping).length > 0 ? columnMapping : detectedIndex;
  const hasHeader = Object.keys(headerIndex).length >= 2;
  const dataRows = hasHeader ? grid.slice(headerRowIndex + 1) : grid;
  const rows: ImportedProgrammationRow[] = [];

  for (const cells of dataRows) {
    if (cells.every((cell) => !String(cell ?? "").trim())) continue;

    if (hasHeader) {
      rows.push(rowFromCells(cells, headerIndex, cells.join(" | ")));
      continue;
    }

    const joined = cells.join(" ");
    const { period, week } = parsePeriodWeek(joined);
    rows.push({
      id: `row-${Math.random().toString(36).slice(2, 10)}`,
      periodNumber: period,
      weekNumber: week,
      weekLabel: week ? `S${week}` : "",
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
