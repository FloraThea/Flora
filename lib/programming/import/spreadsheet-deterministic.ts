/**
 * Analyse déterministe des tableurs — dates, jours, séquences, séances.
 * Aucune IA : lecture directe des cellules.
 */

const FRENCH_DAYS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;

const DAY_ALIASES: Record<string, string> = {
  lun: "lundi",
  mar: "mardi",
  mer: "mercredi",
  jeu: "jeudi",
  ven: "vendredi",
  sam: "samedi",
  dim: "dimanche",
};

/** Convertit un numéro de série Excel en date ISO (AAAA-MM-JJ). */
export function excelSerialToIsoDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 60000) return null;
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + serial * 86400000);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function extractSchoolYearFromText(text: string): string | null {
  const match = text.match(/\b(20\d{2})\s*[-/]\s*(20\d{2}|(?:\d{2}))\b/);
  if (!match) return null;
  const start = match[1];
  let end = match[2];
  if (end.length === 2) end = `20${end}`;
  return `${start}-${end.slice(-4)}`;
}

/** Date partielle JJ/MM complétée avec une année scolaire (sept→déc = début, jan→août = fin). */
export function parsePartialFrenchDate(raw: string, schoolYear?: string | null): string | null {
  const text = raw.trim();
  if (!text || !schoolYear) return null;

  const partial = text.match(/^(\d{1,2})[/.-](\d{1,2})$/);
  if (!partial) return null;

  const day = partial[1].padStart(2, "0");
  const month = Number(partial[2]);
  const parts = schoolYear.match(/^(20\d{2})-(20\d{2}|\d{2})$/);
  if (!parts) return null;

  const startYear = parts[1];
  let endYear = parts[2];
  if (endYear.length === 2) endYear = `20${endYear}`;
  const year = month >= 9 ? startYear : endYear;

  return `${year}-${String(month).padStart(2, "0")}-${day}`;
}

export function parseCalendarDateCell(
  raw: string,
  numericValue?: number,
  schoolYear?: string | null,
): string | null {
  const text = raw.trim();
  if (!text && numericValue !== undefined) {
    return excelSerialToIsoDate(numericValue);
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const frMatch = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (frMatch) {
    const day = frMatch[1].padStart(2, "0");
    const month = frMatch[2].padStart(2, "0");
    let year = frMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  const partial = parsePartialFrenchDate(text, schoolYear);
  if (partial) return partial;

  const asNumber = Number(text.replace(",", "."));
  if (Number.isFinite(asNumber) && asNumber > 30000 && asNumber < 60000) {
    return excelSerialToIsoDate(asNumber);
  }

  if (numericValue !== undefined) {
    return excelSerialToIsoDate(numericValue);
  }

  return null;
}

export function parseFrenchDayOfWeek(raw: string): string | null {
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .trim();

  if (!normalized) return null;

  for (const day of FRENCH_DAYS) {
    if (normalized === day || normalized.startsWith(day.slice(0, 3))) return day;
  }

  for (const [alias, full] of Object.entries(DAY_ALIASES)) {
    if (normalized === alias || normalized.startsWith(alias)) return full;
  }

  return null;
}

export function dayOfWeekFromIsoDate(isoDate: string): string | null {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return FRENCH_DAYS[date.getUTCDay()] ?? null;
}

export type SequenceSeanceParse = {
  sequence: string;
  seance: string;
  weekNumber: number | null;
  confidence: number;
  note?: string;
};

/**
 * Interprète une cellule séquence / séance / semaine.
 * Ne décide jamais uniquement sur une cellule isolée sans contexte de colonne.
 */
export function parseSequenceSeanceCell(
  raw: string,
  columnKind: "sequence" | "seance" | "week" | "unknown",
): SequenceSeanceParse {
  const text = raw.trim();
  if (!text) {
    return { sequence: "", seance: "", weekNumber: null, confidence: 0 };
  }

  const lower = text.toLowerCase();

  if (columnKind === "week" || /\b(semaine|sem\.?)\s*(\d+)/i.test(text)) {
    const weekMatch =
      text.match(/(?:semaine|sem\.?)\s*(\d+)/i) ||
      text.match(/^s\s*(\d+)$/i) ||
      text.match(/^s(\d+)$/i);
    if (weekMatch) {
      return {
        sequence: "",
        seance: "",
        weekNumber: Number(weekMatch[1]),
        confidence: 0.95,
        note: "semaine",
      };
    }
  }

  const seqMatch = text.match(/(?:s[ée]q(?:uence)?\.?\s*|module\s*|le[cç]on\s*)?(\d+)/i);
  const explicitSeq = /s[ée]q|module|le[cç]on/i.test(lower);

  if (columnKind === "sequence" || explicitSeq) {
    return {
      sequence: text,
      seance: "",
      weekNumber: null,
      confidence: columnKind === "sequence" ? 0.95 : 0.75,
      note: "sequence",
    };
  }

  const seanceMatch = text.match(/(?:s[ée]ance\s*(?:n[°o]?\s*)?)?(\d+)/i);
  const explicitSeance = /s[ée]ance/i.test(lower);

  if (columnKind === "seance" || explicitSeance) {
    return {
      sequence: "",
      seance: text,
      weekNumber: null,
      confidence: columnKind === "seance" ? 0.95 : 0.8,
      note: "seance",
    };
  }

  if (/^s\s*(\d+)$/i.test(text) && columnKind === "unknown") {
    return {
      sequence: "",
      seance: "",
      weekNumber: Number(text.match(/(\d+)/)?.[1]),
      confidence: 0.4,
      note: "s_ambigu_faible_confiance",
    };
  }

  if (seqMatch && columnKind === "unknown") {
    return {
      sequence: text,
      seance: "",
      weekNumber: null,
      confidence: 0.5,
      note: "numero_ambigu",
    };
  }

  return { sequence: text, seance: "", weekNumber: null, confidence: 0.3 };
}

/** Propage les valeurs non vides de la ligne précédente (cellules fusionnées / héritage). */
export function forwardFillGridRows(grid: string[][]): string[][] {
  if (grid.length === 0) return grid;

  const filled = grid.map((row) => [...row]);
  for (let rowIndex = 1; rowIndex < filled.length; rowIndex += 1) {
    const prev = filled[rowIndex - 1];
    const current = filled[rowIndex];
    for (let col = 0; col < current.length; col += 1) {
      if (!String(current[col] ?? "").trim() && String(prev[col] ?? "").trim()) {
        current[col] = prev[col];
      }
    }
  }
  return filled;
}

export function detectDateContradiction(isoDate: string | null, dayLabel: string | null): string | null {
  if (!isoDate || !dayLabel) return null;
  const fromDate = dayOfWeekFromIsoDate(isoDate);
  const normalizedDay = parseFrenchDayOfWeek(dayLabel);
  if (!fromDate || !normalizedDay) return null;
  if (fromDate !== normalizedDay) {
    return `Contradiction date/jour : ${isoDate} (${fromDate}) vs « ${dayLabel} » (${normalizedDay}). La date est conservée.`;
  }
  return null;
}
