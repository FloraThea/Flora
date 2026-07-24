import type { DocumentTreeNodeType } from "./types";

export type ParsedHeading = {
  type: DocumentTreeNodeType;
  level: number;
  label: string;
  title: string;
  moduleNumber?: number;
  seanceNumber?: number;
  sessionCount?: number;
  confidence: number;
};

/** Sommaire MHM : « Module 12 – 7 séances » */
const MHM_MODULE_SUMMARY_PATTERN =
  /^Module\s+(\d+)\s*[—–-]\s*(\d+)\s*s[ée]ances?\s*$/i;

/** Séance dans le sommaire : « Séance 3 . . . . » */
const TOC_SEANCE_PATTERN = /^S[ée]ance\s+(\d+)(?:\s*[.\s]+)?$/i;

/** Séance dans le corps : « SÉANCE 4 » ou « Séance 2 — Titre » */
const BODY_SEANCE_PATTERN = /^S[ée]ance\s+(\d+)\s*(?:[—–\-:.]\s*(.*))?$/i;

const GENERIC_HEADING_PATTERNS: Array<{
  type: DocumentTreeNodeType;
  level: number;
  pattern: RegExp;
  confidence: number;
}> = [
  { type: "partie", level: 1, pattern: /^partie\s+([IVXLC\d]+|[\wÀ-ÿ]+)\s*[—\-–:.]?\s*(.*)$/i, confidence: 0.9 },
  { type: "chapitre", level: 2, pattern: /^chapitre\s+(\d+)\s*[—\-–:.]?\s*(.*)$/i, confidence: 0.9 },
  { type: "module", level: 3, pattern: /^module\s+(\d+)\s*[—\-–:.]?\s*(.*)$/i, confidence: 0.7 },
  { type: "module", level: 3, pattern: /^m(\d+)\s*[—\-–:.]?\s*(.*)$/i, confidence: 0.65 },
  { type: "sequence", level: 3, pattern: /^s[ée]quence\s+(\d+)\s*[—\-–:.]?\s*(.*)$/i, confidence: 0.85 },
  { type: "unite", level: 3, pattern: /^unit[ée]\s+(\d+)\s*[—\-–:.]?\s*(.*)$/i, confidence: 0.85 },
  { type: "seance", level: 4, pattern: /^s[ée]ance\s+(\d+)\s*[—\-–:.]?\s*(.*)$/i, confidence: 0.75 },
  { type: "activite", level: 5, pattern: /^activit[ée]\s+(\d+)\s*[—\-–:.]?\s*(.*)$/i, confidence: 0.8 },
  { type: "objectif", level: 5, pattern: /^objectif\s*[—\-–:.]?\s*(.+)$/i, confidence: 0.8 },
  { type: "competence", level: 5, pattern: /^comp[ée]tence\s*[—\-–:.]?\s*(.+)$/i, confidence: 0.8 },
  { type: "materiel", level: 5, pattern: /^mat[ée]riel\s*[—\-–:.]?\s*(.+)$/i, confidence: 0.8 },
  { type: "ressource", level: 5, pattern: /^ressource\s*[—\-–:.]?\s*(.+)$/i, confidence: 0.8 },
];

export function normalizeDocumentLine(line: string): string {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\.{2,}/g, "")
    .trim();
}

export function detectMhmGuideProfile(text: string, filename: string): boolean {
  const haystack = `${filename}\n${text.slice(0, 12000)}`.toLowerCase();
  if (/mhm|guide du ma[iî]tre/i.test(haystack)) {
    const summaryModules = text
      .split(/\r?\n/)
      .map(normalizeDocumentLine)
      .filter((line) => MHM_MODULE_SUMMARY_PATTERN.test(line));
    return summaryModules.length >= 20;
  }
  return false;
}

function parseMhmModuleSummary(line: string): ParsedHeading | null {
  const match = normalizeDocumentLine(line).match(MHM_MODULE_SUMMARY_PATTERN);
  if (!match) return null;

  const moduleNumber = Number.parseInt(match[1] ?? "0", 10);
  const sessionCount = Number.parseInt(match[2] ?? "0", 10);
  if (!moduleNumber || !sessionCount) return null;

  return {
    type: "module",
    level: 3,
    label: `Module ${moduleNumber} — ${sessionCount} séances`,
    title: `${sessionCount} séances`,
    moduleNumber,
    sessionCount,
    confidence: 0.98,
  };
}

function parseSeanceHeading(line: string, isMhmGuide: boolean): ParsedHeading | null {
  const normalized = normalizeDocumentLine(line);
  if (!normalized || normalized.length > 120) return null;

  const tocMatch = normalized.match(TOC_SEANCE_PATTERN);
  if (tocMatch) {
    const seanceNumber = Number.parseInt(tocMatch[1] ?? "0", 10);
    if (!seanceNumber) return null;
    return {
      type: "seance",
      level: 4,
      label: `Séance ${seanceNumber}`,
      title: "",
      seanceNumber,
      confidence: isMhmGuide ? 0.92 : 0.75,
    };
  }

  const bodyMatch = normalized.match(BODY_SEANCE_PATTERN);
  if (!bodyMatch) return null;

  const seanceNumber = Number.parseInt(bodyMatch[1] ?? "0", 10);
  const title = (bodyMatch[2] ?? "").trim();
  if (!seanceNumber) return null;

  return {
    type: "seance",
    level: 4,
    label: title ? `Séance ${seanceNumber} — ${title}` : `Séance ${seanceNumber}`,
    title,
    seanceNumber,
    confidence: 0.9,
  };
}

function parseGenericHeading(line: string): ParsedHeading | null {
  const normalized = normalizeDocumentLine(line);
  if (!normalized || normalized.length > 200) return null;

  if (/^module\s+\d+\s*:\s*$/i.test(normalized)) return null;
  if (/^module\s+\d+\s+[a-zàâäéèêëïîôùûüç]/i.test(normalized) && !/s[ée]ances?/i.test(normalized)) {
    return null;
  }

  for (const candidate of GENERIC_HEADING_PATTERNS) {
    const match = normalized.match(candidate.pattern);
    if (!match) continue;

    const number = match[1]?.trim() ?? "";
    const title = (match[2] ?? "").trim();
    const typeLabel =
      candidate.type === "module"
        ? `Module ${number}${title ? ` — ${title}` : ""}`
        : candidate.type === "seance"
          ? `Séance ${number}${title ? ` — ${title}` : ""}`
          : title || normalized;

    return {
      type: candidate.type,
      level: candidate.level,
      label: typeLabel,
      title: title || normalized,
      moduleNumber: candidate.type === "module" ? Number.parseInt(number, 10) || undefined : undefined,
      seanceNumber: candidate.type === "seance" ? Number.parseInt(number, 10) || undefined : undefined,
      confidence: candidate.confidence,
    };
  }

  return null;
}

export function parseDocumentHeading(
  line: string,
  options: { isMhmGuide: boolean; allowGenericModules: boolean },
): ParsedHeading | null {
  if (options.isMhmGuide) {
    const moduleSummary = parseMhmModuleSummary(line);
    if (moduleSummary) return moduleSummary;

    const seance = parseSeanceHeading(line, true);
    if (seance) return seance;

    return null;
  }

  const seance = parseSeanceHeading(line, false);
  if (seance) return seance;

  if (options.allowGenericModules) {
    return parseGenericHeading(line);
  }

  return parseGenericHeading(line);
}

export function deduplicateModuleHeadings(
  modules: Array<ParsedHeading & { lineIndex: number }>,
): Array<ParsedHeading & { lineIndex: number }> {
  const byNumber = new Map<number, ParsedHeading & { lineIndex: number }>();

  for (const module of modules) {
    const number = module.moduleNumber;
    if (!number) continue;

    const existing = byNumber.get(number);
    if (!existing) {
      byNumber.set(number, module);
      continue;
    }

    if ((module.sessionCount ?? 0) > (existing.sessionCount ?? 0)) {
      byNumber.set(number, module);
      continue;
    }

    if (module.lineIndex < existing.lineIndex && module.sessionCount) {
      byNumber.set(number, module);
    }
  }

  return [...byNumber.values()].sort((left, right) => (left.moduleNumber ?? 0) - (right.moduleNumber ?? 0));
}
