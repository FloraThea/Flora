import type { SlotType } from "../types";
import { getSubjectBaseColor, TIMETABLE_SUBJECTS } from "../subject-palette";
import type { SubjectMappingSuggestion, TimetableImportSession } from "./types";

export const SUBJECT_ALIASES: Record<string, { subject: string; slotType?: SlotType }> = {
  mhm: { subject: "Mathématiques" },
  maths: { subject: "Mathématiques" },
  mathématiques: { subject: "Mathématiques" },
  math: { subject: "Mathématiques" },
  edl: { subject: "Français", slotType: "seance" },
  "étude de la langue": { subject: "Français" },
  "etude de la langue": { subject: "Français" },
  français: { subject: "Français" },
  francais: { subject: "Français" },
  dictée: { subject: "Français" },
  dictee: { subject: "Français" },
  lecture: { subject: "Français" },
  écriture: { subject: "Français" },
  ecriture: { subject: "Français" },
  grammaire: { subject: "Français" },
  qlm: { subject: "Questionner le monde" },
  "questionner le monde": { subject: "Questionner le monde" },
  eps: { subject: "EPS", slotType: "eps" },
  "éducation physique": { subject: "EPS", slotType: "eps" },
  "education physique": { subject: "EPS", slotType: "eps" },
  sport: { subject: "EPS", slotType: "eps" },
  arts: { subject: "Arts plastiques" },
  "arts plastiques": { subject: "Arts plastiques" },
  hda: { subject: "Histoire des arts" },
  "histoire des arts": { subject: "Histoire des arts" },
  anglais: { subject: "Langues vivantes" },
  lv: { subject: "Langues vivantes" },
  "langues vivantes": { subject: "Langues vivantes" },
  allemand: { subject: "Langues vivantes" },
  espagnol: { subject: "Langues vivantes" },
  musique: { subject: "Enseignement moral et civique" },
  emc: { subject: "Enseignement moral et civique" },
  rituel: { subject: "Rituels", slotType: "rituel" },
  rituels: { subject: "Rituels", slotType: "rituel" },
  récré: { subject: "Récréation", slotType: "recreation" },
  recreation: { subject: "Récréation", slotType: "recreation" },
  récréation: { subject: "Récréation", slotType: "recreation" },
  pause: { subject: "Pause méridienne", slotType: "pause_meridienne" },
  "pause méridienne": { subject: "Pause méridienne", slotType: "pause_meridienne" },
  déjeuner: { subject: "Pause méridienne", slotType: "pause_meridienne" },
  dejeuner: { subject: "Pause méridienne", slotType: "pause_meridienne" },
  ce1: { subject: "Décloisonnement", slotType: "decloisonnement" },
  ce2: { subject: "Décloisonnement", slotType: "decloisonnement" },
  declo: { subject: "Décloisonnement", slotType: "decloisonnement" },
  apc: { subject: "APC", slotType: "apc" },
};

export const SUBJECT_COLORS: Record<string, string> = Object.fromEntries(
  TIMETABLE_SUBJECTS.map((subject) => [subject, getSubjectBaseColor(subject)]),
);

const CANONICAL_SUBJECTS = [
  "Français",
  "Mathématiques",
  "Questionner le monde",
  "EPS",
  "Arts plastiques",
  "Histoire des arts",
  "Langues vivantes",
  "Enseignement moral et civique",
  "Rituels",
  "Récréation",
  "Pause méridienne",
  "Décloisonnement",
  "APC",
];

function normalizeLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function mapSubjectLabel(raw: string): SubjectMappingSuggestion {
  const trimmed = raw.trim();
  const normalized = normalizeLabel(trimmed);

  if (!normalized) {
    return {
      sourceLabel: raw,
      suggestedSubject: "",
      alternatives: [],
      confidence: 0,
      needsConfirmation: false,
    };
  }

  const exact = SUBJECT_ALIASES[normalized];
  if (exact) {
    return {
      sourceLabel: trimmed,
      suggestedSubject: exact.subject,
      alternatives: [],
      confidence: 1,
      needsConfirmation: false,
    };
  }

  for (const [alias, mapping] of Object.entries(SUBJECT_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return {
        sourceLabel: trimmed,
        suggestedSubject: mapping.subject,
        alternatives: CANONICAL_SUBJECTS.filter((s) => s !== mapping.subject).slice(0, 3),
        confidence: 0.85,
        needsConfirmation: normalized.length <= 4,
      };
    }
  }

  for (const subject of CANONICAL_SUBJECTS) {
    if (normalizeLabel(subject).includes(normalized) || normalized.includes(normalizeLabel(subject))) {
      return {
        sourceLabel: trimmed,
        suggestedSubject: subject,
        alternatives: CANONICAL_SUBJECTS.filter((s) => s !== subject).slice(0, 3),
        confidence: 0.7,
        needsConfirmation: true,
      };
    }
  }

  return {
    sourceLabel: trimmed,
    suggestedSubject: trimmed,
    alternatives: CANONICAL_SUBJECTS.slice(0, 4),
    confidence: 0.35,
    needsConfirmation: true,
  };
}

export function applySubjectMapping(
  raw: string,
  overrides?: Record<string, string>,
): { subject: string; slotType: SlotType; color: string; mapping: SubjectMappingSuggestion } {
  const override = overrides?.[raw.trim()] ?? overrides?.[normalizeLabel(raw)];
  const mapping = mapSubjectLabel(raw);

  const subject = override ?? mapping.suggestedSubject;
  const alias = SUBJECT_ALIASES[normalizeLabel(raw)];
  const slotType = alias?.slotType ?? inferSlotType(subject);

  return {
    subject,
    slotType,
    color: SUBJECT_COLORS[subject] ?? "#faf7f2",
    mapping: override
      ? { ...mapping, suggestedSubject: subject, needsConfirmation: false, confidence: 1 }
      : mapping,
  };
}

export function inferSlotType(subject: string): SlotType {
  const n = normalizeLabel(subject);
  if (n.includes("recreation") || n.includes("recre")) return "recreation";
  if (n.includes("pause") || n.includes("dejeuner")) return "pause_meridienne";
  if (n.includes("rituel")) return "rituel";
  if (n.includes("eps") || n.includes("sport")) return "eps";
  if (n.includes("apc")) return "apc";
  if (n.includes("declo")) return "decloisonnement";
  return "seance";
}

export function extractLevelAndGroup(raw: string): { level: string; group: string; cleaned: string } {
  let cleaned = raw.trim();
  let level = "";
  let group = "";

  const levelMatch = cleaned.match(/\b(CE1|CE2|CM1|CM2|CP|GS|MS)\b/i);
  if (levelMatch) {
    level = levelMatch[1].toUpperCase();
    cleaned = cleaned.replace(levelMatch[0], "").trim();
  }

  const groupMatch = cleaned.match(/\b(G\d+|Grp\s*\d+|Groupe\s*[A-Z0-9]+)\b/i);
  if (groupMatch) {
    group = groupMatch[1];
    cleaned = cleaned.replace(groupMatch[0], "").trim();
  }

  return { level, group, cleaned };
}

export function collectUncertainMappings(sessions: TimetableImportSession[]): SubjectMappingSuggestion[] {
  const seen = new Set<string>();
  const uncertain: SubjectMappingSuggestion[] = [];

  for (const session of sessions) {
    if (session.isEmpty || !session.rawLabel) continue;
    const key = session.rawLabel.trim();
    if (seen.has(key)) continue;

    const mapping = mapSubjectLabel(key);
    if (mapping.needsConfirmation) {
      seen.add(key);
      uncertain.push(mapping);
    }
  }

  return uncertain;
}
