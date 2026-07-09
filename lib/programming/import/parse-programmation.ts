import { extractTextFromBuffer } from "@/lib/documents/extract-text";
import type {
  ImportedProgrammationRow,
  ParsedProgrammationImport,
  ProgrammationImportFormat,
} from "./types";

function detectFormat(fileName: string, mimeType?: string): ProgrammationImportFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (lower.endsWith(".csv") || mimeType === "text/csv") return "csv";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) return "excel";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "word";
  return "text";
}

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

function parseCsvLine(line: string, delimiter: string): string[] {
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

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes("\t")) return "\t";
  if (headerLine.split(";").length > headerLine.split(",").length) return ";";
  return ",";
}

function mapHeaderIndex(headers: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  headers.forEach((header, position) => {
    const normalized = header
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    if (normalized.includes("periode") || normalized === "p") index.period = position;
    if (normalized.includes("semaine") || normalized === "s") index.week = position;
    if (normalized.includes("discipline") || normalized.includes("matiere")) index.discipline = position;
    if (normalized.includes("niveau")) index.niveau = position;
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

function rowFromCells(cells: string[], headerIndex: Record<string, number>, rawLine: string): ImportedProgrammationRow {
  const get = (key: string) => {
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

function parseStructuredText(text: string): ImportedProgrammationRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headerIndex = mapHeaderIndex(parseCsvLine(lines[0], delimiter));
  const hasHeader = Object.keys(headerIndex).length >= 2;

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows: ImportedProgrammationRow[] = [];

  for (const line of dataLines) {
    const cells = parseCsvLine(line, delimiter);
    if (cells.every((cell) => !cell.trim())) continue;

    if (hasHeader) {
      rows.push(rowFromCells(cells, headerIndex, line));
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
      rawLine: line,
    });
  }

  return rows;
}

function inferDiscipline(rows: ImportedProgrammationRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row.discipline) continue;
    counts.set(row.discipline, (counts.get(row.discipline) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? "";
}

function inferNiveau(rows: ImportedProgrammationRow[]): string {
  for (const row of rows) {
    if (row.niveau) return row.niveau;
  }
  return "";
}

export async function parseProgrammationFile(input: {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
  pastedText?: string;
}): Promise<ParsedProgrammationImport> {
  const format = input.pastedText ? "text" : detectFormat(input.fileName, input.mimeType);
  const warnings: string[] = [];

  let text = input.pastedText?.trim() ?? "";

  if (!text) {
    if (format === "csv" || format === "text") {
      text = input.buffer.toString("utf8");
    } else if (format === "pdf") {
      const extracted = await extractTextFromBuffer(input.buffer, input.fileName);
      text = extracted.text;
    } else if (format === "word" || format === "excel") {
      warnings.push(
        "Extraction automatique limitée pour Word/Excel. Collez le tableau ou exportez en CSV pour une analyse optimale.",
      );
      text = input.buffer.toString("utf8");
    }
  }

  const rows = parseStructuredText(text);
  if (rows.length === 0) {
    warnings.push("Aucune ligne structurée détectée. Vérifiez le format (colonnes période, semaine, séance…).");
  }

  return {
    format,
    fileName: input.fileName,
    discipline: inferDiscipline(rows),
    niveau: inferNiveau(rows),
    rows,
    warnings,
    extractedTextPreview: text.slice(0, 1200),
  };
}
