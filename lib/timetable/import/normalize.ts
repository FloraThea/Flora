const DAY_ALIASES: Array<{ regex: RegExp; day: string }> = [
  { regex: /\blundi\b|\blun\.?\b/i, day: "Lundi" },
  { regex: /\bmardi\b|\bmar\.?\b/i, day: "Mardi" },
  { regex: /\bmercredi\b|\bmer\.?\b/i, day: "Mercredi" },
  { regex: /\bjeudi\b|\bjeu\.?\b/i, day: "Jeudi" },
  { regex: /\bvendredi\b|\bven\.?\b/i, day: "Vendredi" },
  { regex: /\bsamedi\b|\bsam\.?\b/i, day: "Samedi" },
];

export const CANONICAL_DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"] as const;

export function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeCellText(value: string): string {
  return stripAccents(String(value ?? "").trim().toLowerCase());
}

/** Detect day names anywhere inside a cell (substring, accent/case tolerant). */
export function findDaysInCell(cell: string): Array<{ day: string; index: number }> {
  const normalized = normalizeCellText(cell);
  if (!normalized) return [];

  const found: Array<{ day: string; index: number }> = [];
  for (const { regex, day } of DAY_ALIASES) {
    const match = normalized.match(regex);
    if (match && match.index !== undefined) {
      found.push({ day, index: match.index });
    }
  }

  found.sort((a, b) => a.index - b.index);
  const unique: Array<{ day: string; index: number }> = [];
  for (const item of found) {
    if (!unique.some((u) => u.day === item.day)) unique.push(item);
  }
  return unique;
}

export function normalizeDay(value: string): string | null {
  return findDaysInCell(value)[0]?.day ?? null;
}

const TIME_SUBSTRING =
  /(?:^|[^\d])(\d{1,2})\s*[:hH.]\s*(\d{2})(?:\s*[-–—]\s*(\d{1,2})\s*[:hH.]\s*(\d{2}))?|(?:^|[^\d])(\d{1,2})\s*h\s*(\d{2})?(?:\s*[-–—]\s*(\d{1,2})\s*h\s*(\d{2})?)?/gi;

function formatTime(hour: string, minute = "00"): string {
  return `${String(Number(hour)).padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** Parse the first time found in a cell; supports ranges (returns start only). */
export function parseTimeCell(raw: string): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const compact = value.replace(/\s/g, "");

  const colonMatch = compact.match(/^(\d{1,2})[:hH.](\d{2})$/);
  if (colonMatch) return formatTime(colonMatch[1], colonMatch[2]);

  const hMatch = compact.match(/^(\d{1,2})h(\d{2})?$/i);
  if (hMatch) return formatTime(hMatch[1], hMatch[2] ?? "00");

  if (/^\d{1,2}$/.test(compact)) {
    const hour = Number(compact);
    if (hour >= 7 && hour <= 20) return formatTime(compact, "00");
  }

  TIME_SUBSTRING.lastIndex = 0;
  const rangeMatch = TIME_SUBSTRING.exec(value);
  if (rangeMatch) {
    if (rangeMatch[1] && rangeMatch[2]) return formatTime(rangeMatch[1], rangeMatch[2]);
    if (rangeMatch[5]) return formatTime(rangeMatch[5], rangeMatch[6] ?? "00");
  }

  return null;
}

export function parseTimeRange(raw: string): { start: string; end: string | null } | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  const rangePattern =
    /(\d{1,2})\s*[:hH.]\s*(\d{2})\s*[-–—]\s*(\d{1,2})\s*[:hH.]\s*(\d{2})/i;
  const match = value.match(rangePattern);
  if (match) {
    return {
      start: formatTime(match[1], match[2]),
      end: formatTime(match[3], match[4]),
    };
  }

  const start = parseTimeCell(value);
  return start ? { start, end: null } : null;
}

export function isDecorativeCell(cell: string): boolean {
  const text = normalizeCellText(cell);
  if (!text) return true;
  if (findDaysInCell(cell).length > 0) return false;
  if (parseTimeCell(cell)) return false;

  const decorativeHints = [
    "emploi du temps",
    "classe",
    "enseignant",
    "professeur",
    "annee scolaire",
    "semestre",
    "periode",
    "logo",
    "ecole",
    "remarque",
    "note",
  ];
  return decorativeHints.some((hint) => text.includes(hint)) && text.length < 80;
}

export function isLikelySubjectCell(cell: string): boolean {
  const text = String(cell ?? "").trim();
  if (!text || text.length > 120) return false;
  if (parseTimeCell(text)) return false;
  if (findDaysInCell(text).length > 0) return false;
  return text.length >= 2;
}
