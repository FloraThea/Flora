/**
 * Analyse déterministe de documents pédagogiques (séquences / séances).
 * Multi-stratégies avec score de confiance — aucune mise en page imposée.
 */

import { analyzeGridParse, rowsFromGrid } from "@/lib/programming/import/grid-parser";
import type { ImportedProgrammationRow } from "@/lib/programming/import/types";
import {
  isSupportedImageFile,
  resolveFileExtension,
} from "@/lib/import/accepted-formats";

export type ParsedLessonField<T = string> = {
  value: T;
  confidence: number;
  source?: string;
};

export type ParsedLessonSession = {
  sessionNumber: number;
  title: ParsedLessonField;
  dureeMinutes: ParsedLessonField<number>;
  date: ParsedLessonField<string | null>;
  objectif: ParsedLessonField;
  competence: ParsedLessonField;
  deroulement: ParsedLessonField;
  materiel: ParsedLessonField<string[]>;
  ressources: ParsedLessonField<string[]>;
  evaluation: ParsedLessonField;
  differentiation: ParsedLessonField;
  phases: Array<{
    title: string;
    content: string;
    confidence: number;
  }>;
  parseConfidence: number;
  uncertainFields: string[];
  rawLine?: string;
};

export type ParsedLessonSequence = {
  title: ParsedLessonField;
  matiere: ParsedLessonField;
  sousMatiere: ParsedLessonField;
  niveau: ParsedLessonField;
  periodNumber: ParsedLessonField<number | null>;
  weekNumbers: ParsedLessonField<number[]>;
  dureeEstimeeMinutes: ParsedLessonField<number>;
  sessionCount: ParsedLessonField<number>;
  objectifs: ParsedLessonField<string[]>;
  competences: ParsedLessonField<string[]>;
  attendus: ParsedLessonField<string[]>;
  prerequis: ParsedLessonField<string[]>;
  materiel: ParsedLessonField<string[]>;
  ressources: ParsedLessonField<string[]>;
  evaluation: ParsedLessonField;
  prolongements: ParsedLessonField<string[]>;
  differentiation: ParsedLessonField;
  sessions: ParsedLessonSession[];
  parseConfidence: number;
  uncertainFields: string[];
};

export type LessonDocumentParseResult = {
  format: string;
  fileName: string;
  sequences: ParsedLessonSequence[];
  standaloneSessions: ParsedLessonSession[];
  warnings: string[];
  extractedTextPreview: string;
  confidence: number;
  rejectReason?: string;
  analysisNotes: string[];
};

const FIELD_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  { key: "objectif", pattern: /^objectifs?\s*[:：-]/i },
  { key: "competence", pattern: /^comp[ée]tences?\s*(?:bo\s*)?[:：-]/i },
  { key: "attendu", pattern: /^attendus?\s*[:：-]/i },
  { key: "prerequis", pattern: /^pr[ée]requis\s*[:：-]/i },
  { key: "materiel", pattern: /^mat[ée]riel\s*[:：-]/i },
  { key: "ressource", pattern: /^ressources?\s*[:：-]/i },
  { key: "evaluation", pattern: /^[eé]valuation\s*[:：-]/i },
  { key: "prolongement", pattern: /^prolongements?\s*[:：-]/i },
  { key: "differentiation", pattern: /^diff[ée]renciation\s*[:：-]/i },
  { key: "deroulement", pattern: /^d[ée]roulement\s*[:：-]/i },
  { key: "trace", pattern: /^trace\s+[eé]crite\s*[:：-]/i },
  { key: "duree", pattern: /^dur[ée]e\s*[:：-]/i },
  { key: "matiere", pattern: /^(?:mati[èe]re|discipline)\s*[:：-]/i },
  { key: "niveau", pattern: /^niveau\s*[:：-]/i },
  { key: "periode", pattern: /^p[ée]riode\s*[:：-]/i },
];

const PHASE_PATTERNS = [
  /^phase\s*\d+/i,
  /^accueil\b/i,
  /^rappel\b/i,
  /^manipulation\b/i,
  /^institutionnalisation\b/i,
  /^entra[îi]nement\b/i,
  /^synth[èe]se\b/i,
  /^trace\s+[eé]crite\b/i,
];

function field<T>(value: T, confidence: number, source?: string): ParsedLessonField<T> {
  return { value, confidence, source };
}

function splitList(text: string): string[] {
  return text
    .split(/\n|(?:\s*[,;•·]\s*)|(?:\s+et\s+)/i)
    .map((item) => item.replace(/^[-–•·]\s*/, "").trim())
    .filter(Boolean);
}

function parseDurationMinutes(text: string): number | null {
  const hourMatch = text.match(/(\d+)\s*h(?:\s*(\d+))?/i);
  if (hourMatch) {
    return Number(hourMatch[1]) * 60 + Number(hourMatch[2] ?? 0);
  }
  const minuteMatch = text.match(/(\d+)\s*min/i);
  if (minuteMatch) return Number(minuteMatch[1]);
  const plain = text.match(/^(\d+)$/);
  if (plain) return Number(plain[1]);
  return null;
}

function parsePeriodWeek(text: string): { period: number | null; week: number | null } {
  const periodMatch = text.match(/p[ée]riode\s*(\d+)/i);
  const weekMatch = text.match(/(?:semaine|sem\.?|s)\s*(\d+)/i);
  return {
    period: periodMatch ? Number(periodMatch[1]) : null,
    week: weekMatch ? Number(weekMatch[1]) : null,
  };
}

function detectFieldBlocks(lines: string[]): Map<string, string> {
  const blocks = new Map<string, string>();
  let currentKey: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentKey) return;
    blocks.set(currentKey, buffer.join("\n").trim());
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const matched = FIELD_PATTERNS.find(({ pattern }) => pattern.test(trimmed));
    if (matched) {
      flush();
      currentKey = matched.key;
      buffer.push(trimmed.replace(matched.pattern, "").trim());
      continue;
    }

    if (currentKey) buffer.push(trimmed);
  }

  flush();
  return blocks;
}

function parsePhasesFromText(text: string): ParsedLessonSession["phases"] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const phases: ParsedLessonSession["phases"] = [];
  let current: ParsedLessonSession["phases"][number] | null = null;

  for (const line of lines) {
    if (PHASE_PATTERNS.some((pattern) => pattern.test(line))) {
      if (current) phases.push(current);
      current = { title: line.replace(/[:：-]\s*$/, ""), content: "", confidence: 0.75 };
      continue;
    }
    if (current) current.content += `${current.content ? "\n" : ""}${line}`;
  }

  if (current) phases.push(current);
  return phases;
}

function sessionFromRow(row: ImportedProgrammationRow, index: number): ParsedLessonSession {
  const uncertain: string[] = [];
  const weekNumber = row.weekNumber;
  const title = row.seance || row.sequence || row.objectif || `Séance ${index + 1}`;
  if (!row.seance && !row.objectif) uncertain.push("title");

  return {
    sessionNumber: index + 1,
    title: field(title, row.seance ? 0.9 : 0.55),
    dureeMinutes: field(45, 0.3),
    date: field(row.calendarDate, row.calendarDate ? 0.9 : 0.2),
    objectif: field(row.objectif, row.objectif ? 0.85 : 0.2),
    competence: field(row.competences.join(", "), row.competences.length > 0 ? 0.85 : 0.2),
    deroulement: field(row.deroulement, row.deroulement ? 0.8 : 0.2),
    materiel: field(row.materiel, row.materiel.length > 0 ? 0.8 : 0.2),
    ressources: field(row.ressources, row.ressources.length > 0 ? 0.8 : 0.2),
    evaluation: field(row.evaluation, row.evaluation ? 0.75 : 0.2),
    differentiation: field(row.differenciation, row.differenciation ? 0.75 : 0.2),
    phases: row.deroulement
      ? parsePhasesFromText(row.deroulement)
      : [],
    parseConfidence: Math.max(0.35, row.parseConfidence ?? 0.5),
    uncertainFields: uncertain,
    rawLine: row.rawLine,
  };
}

function sequenceFromRows(
  rows: ImportedProgrammationRow[],
  title: string,
  matiere: string,
): ParsedLessonSequence {
  const sessions = rows.map((row, index) => sessionFromRow(row, index));
  const periods = [...new Set(rows.map((row) => row.periodNumber).filter(Boolean))] as number[];
  const weeks = [...new Set(rows.map((row) => row.weekNumber).filter(Boolean))] as number[];
  const objectifs = rows.map((row) => row.objectif).filter(Boolean);
  const competences = [...new Set(rows.flatMap((row) => row.competences))];
  const materiel = [...new Set(rows.flatMap((row) => row.materiel))];
  const ressources = [...new Set(rows.flatMap((row) => row.ressources))];

  const uncertain: string[] = [];
  if (!title) uncertain.push("title");
  if (!matiere) uncertain.push("matiere");
  if (sessions.some((session) => session.uncertainFields.length > 0)) uncertain.push("sessions");

  const confidence =
    sessions.length > 0
      ? sessions.reduce((sum, session) => sum + session.parseConfidence, 0) / sessions.length
      : 0.2;

  return {
    title: field(title || `Séquence importée`, title ? 0.85 : 0.45),
    matiere: field(matiere, matiere ? 0.85 : 0.35),
    sousMatiere: field("", 0.1),
    niveau: field(rows.find((row) => row.niveau)?.niveau ?? "", rows[0]?.niveau ? 0.8 : 0.2),
    periodNumber: field(periods[0] ?? null, periods[0] ? 0.8 : 0.25),
    weekNumbers: field(weeks, weeks.length > 0 ? 0.75 : 0.25),
    dureeEstimeeMinutes: field(sessions.length * 45, 0.4),
    sessionCount: field(sessions.length, sessions.length > 0 ? 0.9 : 0.2),
    objectifs: field(objectifs, objectifs.length > 0 ? 0.8 : 0.2),
    competences: field(competences, competences.length > 0 ? 0.8 : 0.2),
    attendus: field([], 0.1),
    prerequis: field([], 0.1),
    materiel: field(materiel, materiel.length > 0 ? 0.75 : 0.2),
    ressources: field(ressources, ressources.length > 0 ? 0.75 : 0.2),
    evaluation: field("", 0.1),
    prolongements: field([], 0.1),
    differentiation: field("", 0.1),
    sessions,
    parseConfidence: confidence,
    uncertainFields: uncertain,
  };
}

function groupRowsBySequence(rows: ImportedProgrammationRow[]): Map<string, ImportedProgrammationRow[]> {
  const groups = new Map<string, ImportedProgrammationRow[]>();

  for (const row of rows) {
    const key = row.sequence?.trim() || "__default__";
    const bucket = groups.get(key) ?? [];
    bucket.push(row);
    groups.set(key, bucket);
  }

  return groups;
}

function parseFromStructuredRows(
  rows: ImportedProgrammationRow[],
  fileName: string,
  discipline: string,
): LessonDocumentParseResult {
  if (rows.length === 0) {
    return {
      format: "structured",
      fileName,
      sequences: [],
      standaloneSessions: [],
      warnings: ["Aucune ligne structurée détectée dans le tableau."],
      extractedTextPreview: "",
      confidence: 0,
      rejectReason: "no_structured_rows",
      analysisNotes: ["grid_strategy:empty"],
    };
  }

  const groups = groupRowsBySequence(rows);
  const sequences: ParsedLessonSequence[] = [];

  if (groups.size === 1 && groups.has("__default__")) {
    sequences.push(
      sequenceFromRows(
        rows,
        discipline ? `Séquence ${discipline}` : "Séquence importée",
        discipline,
      ),
    );
  } else {
    for (const [sequenceKey, groupRows] of groups) {
      if (sequenceKey === "__default__") continue;
      sequences.push(sequenceFromRows(groupRows, sequenceKey, discipline || groupRows[0]?.discipline || ""));
    }
    const ungrouped = groups.get("__default__") ?? [];
    if (ungrouped.length > 0) {
      sequences.push(
        sequenceFromRows(ungrouped, discipline ? `Séquence ${discipline}` : "Séquence importée", discipline),
      );
    }
  }

  const confidence =
    sequences.reduce((sum, sequence) => sum + sequence.parseConfidence, 0) /
    Math.max(1, sequences.length);

  return {
    format: "structured",
    fileName,
    sequences,
    standaloneSessions: [],
    warnings: [],
    extractedTextPreview: rows
      .slice(0, 5)
      .map((row) => row.rawLine)
      .join("\n"),
    confidence,
    analysisNotes: [
      `grid_strategy:rows=${rows.length}`,
      `grid_strategy:sequences=${sequences.length}`,
    ],
  };
}

function parseSessionSection(sectionLines: string[], sessionNumber: number): ParsedLessonSession {
  const blocks = detectFieldBlocks(sectionLines);
  const titleLine =
    sectionLines.find((line) => /s[ée]ance\s*(?:n[°o]?\s*)?\d+/i.test(line)) ??
    sectionLines[0] ??
    `Séance ${sessionNumber}`;
  const title = titleLine.replace(/^s[ée]ance\s*(?:n[°o]?\s*)?\d+\s*[-–:]\s*/i, "").trim();
  const dureeText = blocks.get("duree") ?? "";
  const dureeMinutes = parseDurationMinutes(dureeText) ?? 45;
  const deroulement = blocks.get("deroulement") ?? "";
  const uncertain: string[] = [];
  if (!blocks.get("objectif")) uncertain.push("objectif");

  return {
    sessionNumber,
    title: field(title || `Séance ${sessionNumber}`, title ? 0.8 : 0.45),
    dureeMinutes: field(dureeMinutes, blocks.get("duree") ? 0.75 : 0.35),
    date: field(null, 0.1),
    objectif: field(blocks.get("objectif") ?? "", blocks.get("objectif") ? 0.85 : 0.25),
    competence: field(blocks.get("competence") ?? "", blocks.get("competence") ? 0.85 : 0.25),
    deroulement: field(deroulement, deroulement ? 0.8 : 0.2),
    materiel: field(splitList(blocks.get("materiel") ?? ""), blocks.get("materiel") ? 0.8 : 0.2),
    ressources: field(splitList(blocks.get("ressource") ?? ""), blocks.get("ressource") ? 0.8 : 0.2),
    evaluation: field(blocks.get("evaluation") ?? "", blocks.get("evaluation") ? 0.75 : 0.2),
    differentiation: field(blocks.get("differentiation") ?? "", blocks.get("differentiation") ? 0.75 : 0.2),
    phases: parsePhasesFromText(deroulement),
    parseConfidence: uncertain.length === 0 ? 0.82 : 0.55,
    uncertainFields: uncertain,
    rawLine: sectionLines.join("\n"),
  };
}

function parseSequenceSection(sectionLines: string[], index: number): ParsedLessonSequence {
  const blocks = detectFieldBlocks(sectionLines);
  const titleLine =
    sectionLines.find((line) => /^s[ée]quence\b/i.test(line)) ??
    sectionLines[0] ??
    `Séquence ${index + 1}`;
  const title = titleLine.replace(/^s[ée]quence\s*(?:n[°o]?\s*)?\d*\s*[-–:]\s*/i, "").trim();
  const periodText = blocks.get("periode") ?? sectionLines.join("\n");
  const { period, week } = parsePeriodWeek(periodText);

  const sessionSections: string[][] = [];
  let currentSession: string[] = [];
  let startedSessions = false;

  for (const line of sectionLines) {
    if (/^s[ée]ance\s*(?:n[°o]?\s*)?\d+/i.test(line)) {
      if (startedSessions && currentSession.length > 0) {
        sessionSections.push(currentSession);
      }
      currentSession = [line];
      startedSessions = true;
      continue;
    }
    if (startedSessions) {
      currentSession.push(line);
    }
  }
  if (startedSessions && currentSession.length > 0) sessionSections.push(currentSession);

  const sessions =
    sessionSections.length > 0
      ? sessionSections.map((lines, sessionIndex) => parseSessionSection(lines, sessionIndex + 1))
      : [];

  const uncertain: string[] = [];
  if (!title) uncertain.push("title");
  if (sessions.length === 0) uncertain.push("sessions");

  return {
    title: field(title || `Séquence ${index + 1}`, title ? 0.82 : 0.45),
    matiere: field(blocks.get("matiere") ?? "", blocks.get("matiere") ? 0.85 : 0.25),
    sousMatiere: field("", 0.1),
    niveau: field(blocks.get("niveau") ?? "", blocks.get("niveau") ? 0.8 : 0.25),
    periodNumber: field(period, period ? 0.75 : 0.25),
    weekNumbers: field(week ? [week] : [], week ? 0.75 : 0.25),
    dureeEstimeeMinutes: field(
      sessions.reduce((sum, session) => sum + session.dureeMinutes.value, 0),
      sessions.length > 0 ? 0.7 : 0.25,
    ),
    sessionCount: field(sessions.length, sessions.length > 0 ? 0.85 : 0.2),
    objectifs: field(splitList(blocks.get("objectif") ?? ""), blocks.get("objectif") ? 0.8 : 0.25),
    competences: field(splitList(blocks.get("competence") ?? ""), blocks.get("competence") ? 0.8 : 0.25),
    attendus: field(splitList(blocks.get("attendu") ?? ""), blocks.get("attendu") ? 0.75 : 0.2),
    prerequis: field(splitList(blocks.get("prerequis") ?? ""), blocks.get("prerequis") ? 0.75 : 0.2),
    materiel: field(splitList(blocks.get("materiel") ?? ""), blocks.get("materiel") ? 0.75 : 0.2),
    ressources: field(splitList(blocks.get("ressource") ?? ""), blocks.get("ressource") ? 0.75 : 0.2),
    evaluation: field(blocks.get("evaluation") ?? "", blocks.get("evaluation") ? 0.75 : 0.2),
    prolongements: field(splitList(blocks.get("prolongement") ?? ""), blocks.get("prolongement") ? 0.7 : 0.2),
    differentiation: field(blocks.get("differentiation") ?? "", blocks.get("differentiation") ? 0.7 : 0.2),
    sessions,
    parseConfidence:
      sessions.length > 0
        ? sessions.reduce((sum, session) => sum + session.parseConfidence, 0) / sessions.length
        : 0.35,
    uncertainFields: uncertain,
  };
}

function parseFromFreeText(text: string, fileName: string): LessonDocumentParseResult {
  const normalized = text.replace(/\r/g, "").trim();
  if (!normalized) {
    return {
      format: "text",
      fileName,
      sequences: [],
      standaloneSessions: [],
      warnings: ["Aucun texte exploitable extrait du document."],
      extractedTextPreview: "",
      confidence: 0,
      rejectReason: "empty_text",
      analysisNotes: ["text_strategy:empty"],
    };
  }

  const lines = normalized.split("\n").map((line) => line.trim());
  const sequenceSections: string[][] = [];
  const standaloneSessionSections: string[][] = [];
  let currentSequence: string[] = [];
  let currentSession: string[] = [];
  let inSequence = false;
  let inStandaloneSession = false;

  for (const line of lines) {
    if (/^s[ée]quence\b/i.test(line)) {
      if (currentSequence.length > 0) sequenceSections.push(currentSequence);
      if (currentSession.length > 0) standaloneSessionSections.push(currentSession);
      currentSequence = [line];
      currentSession = [];
      inSequence = true;
      inStandaloneSession = false;
      continue;
    }

    if (/^s[ée]ance\s*(?:n[°o]?\s*)?\d+/i.test(line) && !inSequence) {
      if (currentSession.length > 0) standaloneSessionSections.push(currentSession);
      currentSession = [line];
      inStandaloneSession = true;
      continue;
    }

    if (inSequence) currentSequence.push(line);
    else if (inStandaloneSession) currentSession.push(line);
  }

  if (currentSequence.length > 0) sequenceSections.push(currentSequence);
  if (currentSession.length > 0) standaloneSessionSections.push(currentSession);

  const sequences = sequenceSections.map((section, index) => parseSequenceSection(section, index));
  const standaloneSessions = standaloneSessionSections.map((section, index) =>
    parseSessionSection(section, index + 1),
  );

  if (sequences.length === 0 && standaloneSessions.length === 0 && lines.length >= 3) {
    sequences.push(parseSequenceSection(lines, 0));
  }

  const candidates = [
    {
      sequences,
      standaloneSessions,
      confidence:
        (sequences.reduce((sum, item) => sum + item.parseConfidence, 0) +
          standaloneSessions.reduce((sum, item) => sum + item.parseConfidence, 0)) /
        Math.max(1, sequences.length + standaloneSessions.length),
      note: "text_strategy:sections",
    },
  ];

  const best = candidates.sort((left, right) => right.confidence - left.confidence)[0]!;

  return {
    format: "text",
    fileName,
    sequences: best.sequences,
    standaloneSessions: best.standaloneSessions,
    warnings: best.sequences.length + best.standaloneSessions.length === 0
      ? ["Structure textuelle peu claire — vérifiez le document avant validation."]
      : [],
    extractedTextPreview: normalized.slice(0, 1200),
    confidence: best.confidence,
    rejectReason:
      best.sequences.length + best.standaloneSessions.length === 0 ? "no_sections_detected" : undefined,
    analysisNotes: [best.note, `text_strategy:sequences=${best.sequences.length}`, `text_strategy:sessions=${best.standaloneSessions.length}`],
  };
}

export async function parseLessonDocument(input: {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
  pastedText?: string;
  mode?: "sequence" | "seance" | "auto";
}): Promise<LessonDocumentParseResult> {
  const warnings: string[] = [];
  const analysisNotes: string[] = [];
  const candidates: LessonDocumentParseResult[] = [];

  if (input.pastedText?.trim()) {
    candidates.push(parseFromFreeText(input.pastedText.trim(), input.fileName));
  } else {
    const ext = resolveFileExtension(input.fileName, input.mimeType);
    const isImage = isSupportedImageFile(input.fileName, input.mimeType);

    try {
      const { parseProgrammationFile } = await import("@/lib/programming/import/parse-programmation");
      const structured = await parseProgrammationFile({
        fileName: input.fileName,
        buffer: input.buffer,
        mimeType: input.mimeType,
      });

      if (structured.sourceGrid?.length) {
        const diagnostics = analyzeGridParse(structured.sourceGrid, { sourceSheet: structured.sheetName });
        analysisNotes.push(
          `excel_sheet=${diagnostics.sheetName ?? "?"}`,
          `excel_confidence=${diagnostics.confidence.toFixed(2)}`,
        );
      }

      if (structured.rows.length > 0) {
        candidates.push({
          ...parseFromStructuredRows(structured.rows, input.fileName, structured.discipline),
          warnings: structured.warnings,
          analysisNotes: [...analysisNotes, ...(structured.warnings.length ? ["grid_warnings"] : [])],
        });
      } else if (structured.extractedTextPreview) {
        candidates.push(parseFromFreeText(structured.extractedTextPreview, input.fileName));
      } else {
        warnings.push(...structured.warnings);
      }
    } catch (error) {
      warnings.push(
        error instanceof Error ? error.message : "Analyse structurée impossible, bascule texte.",
      );
    }

    if (ext === ".pdf" || ext === ".docx" || ext === ".doc" || ext === ".txt") {
      try {
        const { extractTextFromBuffer } = await import("@/lib/documents/extract-text");
        const extracted = await extractTextFromBuffer(input.buffer, input.fileName);
        if (extracted.text.trim()) {
          candidates.push(parseFromFreeText(extracted.text, input.fileName));
        }
      } catch {
        warnings.push("Extraction texte complémentaire limitée.");
      }
    }

    if (isImage) {
      try {
        const { recognizeImageBuffer } = await import("@/lib/documents/extraction/ocr-extractor");
        const ocrText = (await recognizeImageBuffer(input.buffer)).trim();
        if (ocrText) candidates.push(parseFromFreeText(ocrText, input.fileName));
      } catch {
        warnings.push("OCR image limité.");
      }
    }

    if (candidates.length === 0) {
      const { parseProgrammationFile } = await import("@/lib/programming/import/parse-programmation");
      const gridOnly = rowsFromGrid(
        (
          await parseProgrammationFile({
            fileName: input.fileName,
            buffer: input.buffer,
            mimeType: input.mimeType,
          })
        ).sourceGrid ?? [],
      );
      if (gridOnly.rows.length > 0) {
        candidates.push(parseFromStructuredRows(gridOnly.rows, input.fileName, ""));
      }
    }
  }

  if (candidates.length === 0) {
    return {
      format: "unknown",
      fileName: input.fileName,
      sequences: [],
      standaloneSessions: [],
      warnings: [...warnings, "Aucune interprétation fiable — vérifiez le document ou associez les champs manuellement."],
      extractedTextPreview: "",
      confidence: 0,
      rejectReason: "no_candidate",
      analysisNotes: ["all_strategies_failed"],
    };
  }

  const scored = candidates
    .map((candidate) => {
      const itemCount = candidate.sequences.length + candidate.standaloneSessions.length;
      const sessionCount =
        candidate.sequences.reduce((sum, sequence) => sum + sequence.sessions.length, 0) +
        candidate.standaloneSessions.length;
      const score = candidate.confidence + itemCount * 0.05 + sessionCount * 0.01;
      return { candidate, score };
    })
    .sort((left, right) => right.score - left.score);

  const best = scored[0]!.candidate;
  const mode = input.mode ?? "auto";

  const filtered =
    mode === "seance"
      ? {
          ...best,
          sequences: [],
          standaloneSessions: [
            ...best.standaloneSessions,
            ...best.sequences.flatMap((sequence) => sequence.sessions),
          ],
        }
      : mode === "sequence"
        ? {
            ...best,
            standaloneSessions: [],
          }
        : best;

  return {
    ...filtered,
    warnings: [...new Set([...warnings, ...filtered.warnings])],
    analysisNotes: [...analysisNotes, ...filtered.analysisNotes, `best_score=${scored[0]!.score.toFixed(2)}`],
  };
}

export function buildImportSummary(result: LessonDocumentParseResult) {
  const sessionCount =
    result.sequences.reduce((sum, sequence) => sum + sequence.sessions.length, 0) +
    result.standaloneSessions.length;
  const uncertainItems = [
    ...result.sequences.flatMap((sequence) =>
      sequence.uncertainFields.map((field) => `sequence.${field}`),
    ),
    ...result.standaloneSessions.flatMap((session) =>
      session.uncertainFields.map((field) => `session.${field}`),
    ),
  ];

  return {
    sequenceCount: result.sequences.length,
    sessionCount,
    competences: [
      ...new Set(
        result.sequences.flatMap((sequence) => sequence.competences.value).filter(Boolean),
      ),
    ],
    objectifs: [
      ...new Set(
        [
          ...result.sequences.flatMap((sequence) => sequence.objectifs.value),
          ...result.sequences.flatMap((sequence) => sequence.sessions.map((session) => session.objectif.value)),
          ...result.standaloneSessions.map((session) => session.objectif.value),
        ].filter(Boolean),
      ),
    ],
    missingSessions: result.sequences
      .filter((sequence) => sequence.sessions.length === 0)
      .map((sequence) => sequence.title.value),
    uncertainFields: uncertainItems,
    confidence: result.confidence,
  };
}
