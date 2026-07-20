import {
  FRENCH_SUB_SUBJECTS,
  MAIN_SUBJECTS,
  MATH_SUB_SUBJECTS,
  OTHER_SUBJECTS,
} from "@/lib/programming/types";

export const SUBJECT_NONE = "__none__";
export const SUBJECT_ALL = "__all__";

export const KNOWN_SUBJECTS = [
  ...MAIN_SUBJECTS,
  "Histoire",
  "Géographie",
  "Sciences",
  ...OTHER_SUBJECTS,
] as const;

export type KnownSubject = (typeof KNOWN_SUBJECTS)[number];

export function subSubjectsForMatiere(matiere: string): readonly string[] {
  if (matiere === "Français") return FRENCH_SUB_SUBJECTS;
  if (matiere === "Mathématiques") return MATH_SUB_SUBJECTS;
  return [];
}

export function normalizeMatiere(value: string | null | undefined): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();
  for (const subject of KNOWN_SUBJECTS) {
    if (subject.toLowerCase() === lower) return subject;
  }

  if (lower.includes("franc")) return "Français";
  if (lower.includes("math")) return "Mathématiques";
  if (lower.includes("hist")) return "Histoire";
  if (lower.includes("géo") || lower.includes("geo")) return "Géographie";
  if (lower.includes("emc")) return "EMC";
  if (lower.includes("anglais")) return "Anglais";
  if (lower.includes("eps")) return "EPS";
  if (lower.includes("musique")) return "Éducation musicale";
  if (lower.includes("arts")) return "Arts plastiques";
  if (lower.includes("science")) return "Sciences";

  return trimmed;
}

export function normalizeSousMatiere(value: string | null | undefined, matiere: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";

  const options = subSubjectsForMatiere(matiere);
  const lower = trimmed.toLowerCase();
  for (const option of options) {
    if (option.toLowerCase() === lower) return option;
  }

  if (matiere === "Français" && lower.includes("conjug")) return "Conjugaison";
  if (matiere === "Français" && lower.includes("ortho")) return "Orthographe";
  if (matiere === "Français" && lower.includes("gramm")) return "Grammaire";
  if (matiere === "Français" && lower.includes("vocab")) return "Vocabulaire";
  if (matiere === "Français" && lower.includes("lecture")) return "Lecture fluence";

  return trimmed;
}

export function subjectTabLabel(matiere: string): string {
  if (!matiere.trim()) return "Sans matière";
  return matiere.trim();
}

export function buildSubjectTabs(items: Array<{ matiere?: string | null }>): string[] {
  const subjects = new Set<string>();
  for (const item of items) {
    const matiere = normalizeMatiere(item.matiere);
    subjects.add(matiere || SUBJECT_NONE);
  }

  const ordered = [...subjects].sort((a, b) => {
    if (a === SUBJECT_NONE) return 1;
    if (b === SUBJECT_NONE) return -1;
    return subjectTabLabel(a).localeCompare(subjectTabLabel(b), "fr");
  });

  return [SUBJECT_ALL, ...ordered];
}

export function matchesSubjectFilter(
  item: { matiere?: string | null },
  activeSubject: string,
): boolean {
  if (activeSubject === SUBJECT_ALL) return true;
  const matiere = normalizeMatiere(item.matiere);
  if (activeSubject === SUBJECT_NONE) return !matiere;
  return matiere === activeSubject;
}

export function groupBySubMatiere<T extends { sousMatiere?: string | null; sous_matiere?: string | null }>(
  items: T[],
): Array<{ label: string; items: T[] }> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const label =
      String(item.sousMatiere ?? item.sous_matiere ?? "").trim() || "Sans sous-matière";
    const bucket = groups.get(label) ?? [];
    bucket.push(item);
    groups.set(label, bucket);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "fr"))
    .map(([label, groupedItems]) => ({ label, items: groupedItems }));
}

export function inferMatiereFromTitle(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("conjugaison") || lower.includes("orthographe") || lower.includes("grammaire")) {
    return "Français";
  }
  if (lower.includes("math") || lower.includes("nombres") || lower.includes("géométrie")) {
    return "Mathématiques";
  }
  return "";
}

export function inferSousMatiereFromTitle(title: string, matiere: string): string {
  const lower = title.toLowerCase();
  if (matiere === "Français") {
    if (lower.includes("conjugaison")) return "Conjugaison";
    if (lower.includes("orthographe")) return "Orthographe";
    if (lower.includes("grammaire")) return "Grammaire";
    if (lower.includes("vocabulaire")) return "Vocabulaire";
    if (lower.includes("lecture")) return "Lecture fluence";
    if (lower.includes("écriture") || lower.includes("ecriture")) return "Écriture";
  }
  if (matiere === "Mathématiques") {
    if (lower.includes("géométrie") || lower.includes("geometrie")) return "Géométrie";
    if (lower.includes("problème") || lower.includes("probleme")) return "Résolution de problèmes";
  }
  return "";
}
