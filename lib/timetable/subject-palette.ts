import {
  FRENCH_SUB_SUBJECTS,
  MATH_SUB_SUBJECTS,
  OTHER_SUBJECTS,
} from "@/lib/programming/types";

export type PaletteKey = "sage" | "rose" | "blue" | "yellow" | "violet" | "orange";

export type FloraPaletteTone = {
  base: string;
  light: string;
  dark: string;
  border: string;
  text: string;
};

export const FLORA_PALETTE: Record<PaletteKey, FloraPaletteTone> = {
  sage: { base: "#9caf88", light: "#c5d4b8", dark: "#6d8560", border: "#b8ccb0", text: "#3d5235" },
  rose: { base: "#e8c4c4", light: "#f5e4e4", dark: "#b88989", border: "#e0b4b4", text: "#6b4545" },
  blue: { base: "#b8cce8", light: "#d4e4f5", dark: "#7a96b8", border: "#a8c0dc", text: "#3d5068" },
  yellow: { base: "#f0e4b8", light: "#faf3dc", dark: "#c4b078", border: "#e8dcb0", text: "#6b5e38" },
  violet: { base: "#c5b8d4", light: "#e4dcf0", dark: "#9a8ab0", border: "#d0c4de", text: "#524760" },
  orange: { base: "#f0d4b8", light: "#fce8d4", dark: "#c49a88", border: "#e8c8b0", text: "#6b4e38" },
};

export const TIMETABLE_SUBJECTS = [
  "Français",
  "Mathématiques",
  "Questionner le monde",
  "EPS",
  "Arts plastiques",
  "Éducation musicale",
  "Histoire des arts",
  "Langues vivantes",
  "Enseignement moral et civique",
  "Rituels",
  "Récréation",
  "Pause méridienne",
  "Décloisonnement",
  "APC",
] as const;

const SUBJECT_PALETTE_MAP: Record<string, PaletteKey> = {
  Français: "rose",
  Mathématiques: "sage",
  EPS: "orange",
  "Questionner le monde": "violet",
  "Arts plastiques": "violet",
  "Éducation musicale": "blue",
  "Histoire des arts": "violet",
  "Langues vivantes": "blue",
  "Enseignement moral et civique": "yellow",
  Rituels: "yellow",
  Récréation: "yellow",
  "Pause méridienne": "yellow",
  Décloisonnement: "rose",
  APC: "sage",
};

export const SUB_SUBJECTS_BY_SUBJECT: Record<string, readonly string[]> = {
  Français: FRENCH_SUB_SUBJECTS,
  Mathématiques: MATH_SUB_SUBJECTS,
  "Questionner le monde": ["Sciences", "Histoire", "Géographie", "Citoyenneté"],
  EPS: ["Motricité", "Sports collectifs", "Natation", "Athlétisme"],
  "Arts plastiques": ["Création", "Découverte d'œuvres", "Pratique"],
  "Éducation musicale": ["Chant", "Écoute", "Pratique instrumentale"],
  "Histoire des arts": ["Œuvres", "Artistes", "Périodes"],
  "Langues vivantes": ["Compréhension orale", "Expression orale", "Vocabulaire"],
  "Enseignement moral et civique": ["Vivre ensemble", "Engagement", "Médias"],
  Rituels: ["Accueil", "Calcul", "Poésie", "Dictée flash"],
  Décloisonnement: ["Français / Arts", "Français / Maths", "Projet classe"],
  APC: ["Renforcement", "Approfondissement", "Remédiation"],
};

const SLOT_TYPE_PALETTE: Record<string, PaletteKey> = {
  rituel: "yellow",
  recreation: "yellow",
  pause_meridienne: "yellow",
  eps: "orange",
  decloisonnement: "rose",
  apc: "sage",
  intervenant: "blue",
  sortie: "violet",
  evaluation: "rose",
};

export function getSubSubjectsForSubject(subject: string): string[] {
  const known = SUB_SUBJECTS_BY_SUBJECT[subject];
  if (known) return [...known];
  if (OTHER_SUBJECTS.includes(subject as (typeof OTHER_SUBJECTS)[number])) {
    return [subject];
  }
  return [];
}

export function getPaletteKeyForSubject(subject: string, slotType?: string): PaletteKey {
  if (subject && SUBJECT_PALETTE_MAP[subject]) return SUBJECT_PALETTE_MAP[subject];
  if (slotType && SLOT_TYPE_PALETTE[slotType]) return SLOT_TYPE_PALETTE[slotType];
  return "sage";
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function buildSubjectGradient(subject: string, subSubject = "", slotType?: string): string {
  const paletteKey = getPaletteKeyForSubject(subject, slotType);
  const tone = FLORA_PALETTE[paletteKey];
  const subs = getSubSubjectsForSubject(subject);
  const subIndex = subSubject ? subs.indexOf(subSubject) : -1;
  const variation =
    subIndex >= 0
      ? subIndex / Math.max(subs.length - 1, 1)
      : subSubject
        ? (hashString(subSubject) % 100) / 100
        : 0.35;

  const mid = variation > 0.5 ? tone.light : tone.base;
  const end = variation > 0.5 ? tone.base : tone.light;
  return `linear-gradient(145deg, ${tone.light} 0%, ${mid} 45%, ${end} 100%)`;
}

export function getSubjectBaseColor(subject: string, slotType?: string): string {
  const paletteKey = getPaletteKeyForSubject(subject, slotType);
  return FLORA_PALETTE[paletteKey].base;
}

export type SlotAppearance = {
  color: string;
  gradient: string;
  borderColor: string;
  textColor: string;
};

export function resolveSlotAppearance(input: {
  subject: string;
  subSubject?: string;
  slotType?: string;
  color?: string;
  gradient?: string;
}): SlotAppearance {
  const paletteKey = getPaletteKeyForSubject(input.subject, input.slotType);
  const tone = FLORA_PALETTE[paletteKey];
  const color = input.color?.trim() || tone.base;
  const gradient =
    input.gradient?.trim() || buildSubjectGradient(input.subject, input.subSubject ?? "", input.slotType);

  return {
    color,
    gradient,
    borderColor: tone.border,
    textColor: tone.text,
  };
}

export function enrichSlotFields<
  T extends {
    subject: string;
    subSubject?: string;
    slotType?: string;
    color?: string;
    gradient?: string;
    customText?: string;
    metadata?: Record<string, unknown>;
  },
>(slot: T): T & { color: string; gradient: string; customText: string } {
  const legacyColor =
    typeof slot.metadata?.color === "string" ? slot.metadata.color : undefined;
  const appearance = resolveSlotAppearance({
    subject: slot.subject,
    subSubject: slot.subSubject,
    slotType: slot.slotType,
    color: slot.color || legacyColor,
    gradient: slot.gradient,
  });

  return {
    ...slot,
    customText: slot.customText ?? "",
    color: appearance.color,
    gradient: appearance.gradient,
  };
}

/** @deprecated Use getSubjectBaseColor — kept for import compatibility */
export const SUBJECT_COLORS: Record<string, string> = Object.fromEntries(
  TIMETABLE_SUBJECTS.map((subject) => [subject, getSubjectBaseColor(subject)]),
);
