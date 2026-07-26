import { createHash } from "crypto";

/** Niveaux scolaires canoniques reconnus par Flora. */
export const SCHOOL_NIVEAUX = ["PS", "MS", "GS", "CP", "CE1", "CE2", "CM1", "CM2", "6e"] as const;

export type SchoolNiveau = (typeof SCHOOL_NIVEAUX)[number];

export const CYCLE_2_NIVEAUX: SchoolNiveau[] = ["CP", "CE1", "CE2"];
export const CYCLE_3_NIVEAUX: SchoolNiveau[] = ["CM1", "CM2", "6e"];
export const CYCLE_1_NIVEAUX: SchoolNiveau[] = ["PS", "MS", "GS"];

const NIVEAU_ALIASES: Array<{ pattern: RegExp; niveau: SchoolNiveau }> = [
  { pattern: /^cp$/i, niveau: "CP" },
  { pattern: /^c\.?\s*p\.?$/i, niveau: "CP" },
  { pattern: /^cours\s+preparatoire$/i, niveau: "CP" },
  { pattern: /^ce1$/i, niveau: "CE1" },
  { pattern: /^c\.?\s*e\.?\s*1$/i, niveau: "CE1" },
  { pattern: /^cours\s+elementaire\s+premiere\s+annee$/i, niveau: "CE1" },
  { pattern: /^cours\s+elementaire\s+1(?:re|ère)?\s+annee$/i, niveau: "CE1" },
  { pattern: /^ce2$/i, niveau: "CE2" },
  { pattern: /^c\.?\s*e\.?\s*2$/i, niveau: "CE2" },
  { pattern: /^cours\s+elementaire\s+deuxieme\s+annee$/i, niveau: "CE2" },
  { pattern: /^cours\s+elementaire\s+2(?:e|ème)?\s+annee$/i, niveau: "CE2" },
  { pattern: /^cm1$/i, niveau: "CM1" },
  { pattern: /^cours\s+moyen\s+premiere\s+annee$/i, niveau: "CM1" },
  { pattern: /^cm2$/i, niveau: "CM2" },
  { pattern: /^cours\s+moyen\s+deuxieme\s+annee$/i, niveau: "CM2" },
  { pattern: /^6e$/i, niveau: "6e" },
  { pattern: /^sixieme$/i, niveau: "6e" },
  { pattern: /^ps$/i, niveau: "PS" },
  { pattern: /^ms$/i, niveau: "MS" },
  { pattern: /^gs$/i, niveau: "GS" },
];

function normalizeNiveauKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u2032\u2035''`´]/g, "'")
    .replace(/^[\u2192\u279c\u27a1\u27a4➜\-•·\u2022\s]+/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalise une chaîne vers un niveau canonique ou null. */
export function normalizeSchoolNiveau(value: string | null | undefined): SchoolNiveau | null {
  const key = normalizeNiveauKey(String(value ?? ""));
  if (!key) return null;

  for (const entry of NIVEAU_ALIASES) {
    if (entry.pattern.test(key)) return entry.niveau;
  }

  const upper = key.toUpperCase();
  if ((SCHOOL_NIVEAUX as readonly string[]).includes(upper)) {
    return upper as SchoolNiveau;
  }

  return null;
}

/** Détecte un niveau unique dans une ligne (CP, CE1, Cours préparatoire…). */
export function detectSchoolNiveauFromLine(line: string): SchoolNiveau | null {
  const trimmed = line.trim();
  const key = normalizeNiveauKey(trimmed);
  if (!key) return null;

  for (const entry of NIVEAU_ALIASES) {
    if (entry.pattern.test(key)) return entry.niveau;
  }

  if (/^(cp|ce1|ce2|cm1|cm2)\b/i.test(trimmed)) {
    const match = trimmed.match(/^(cp|ce1|ce2|cm1|cm2)\b/i);
    if (match) return normalizeSchoolNiveau(match[1]);
  }

  return null;
}

/** Détecte plusieurs niveaux mentionnés dans une même ligne (ex. « CP CE1 CE2 »). */
export function detectAllSchoolNiveauxFromLine(line: string): SchoolNiveau[] {
  const found = new Set<SchoolNiveau>();
  const trimmed = line.trim();

  for (const niveau of SCHOOL_NIVEAUX) {
    const re = new RegExp(`\\b${niveau}\\b`, "i");
    if (re.test(trimmed)) found.add(niveau);
  }

  const single = detectSchoolNiveauFromLine(trimmed);
  if (single) found.add(single);

  const longForms = [
    { pattern: /cours\s+preparatoire/i, niveau: "CP" as const },
    { pattern: /cours\s+elementaire\s+premiere\s+annee/i, niveau: "CE1" as const },
    { pattern: /cours\s+elementaire\s+deuxieme\s+annee/i, niveau: "CE2" as const },
  ];
  for (const entry of longForms) {
    if (entry.pattern.test(trimmed)) found.add(entry.niveau);
  }

  return [...found];
}

export function isStrictSchoolNiveau(value: string | null | undefined): value is SchoolNiveau {
  return normalizeSchoolNiveau(value) !== null;
}

export function niveauxForCycle(cycle: string): SchoolNiveau[] {
  const normalized = cycle.trim().toLowerCase();
  if (normalized.includes("cycle 2")) return [...CYCLE_2_NIVEAUX];
  if (normalized.includes("cycle 3")) return [...CYCLE_3_NIVEAUX];
  if (normalized.includes("cycle 1")) return [...CYCLE_1_NIVEAUX];
  return [];
}

/** Étend un libellé cycle (ex. « Cycle 2 ») vers les niveaux scolaires du cycle. */
export function expandNiveauToSchoolLevels(
  niveau: string,
  cycle: string,
): SchoolNiveau[] {
  const normalized = normalizeSchoolNiveau(niveau);
  if (normalized) return [normalized];

  const key = normalizeNiveauKey(niveau);
  if (key.includes("cycle 2")) return [...CYCLE_2_NIVEAUX];
  if (key.includes("cycle 3")) return [...CYCLE_3_NIVEAUX];
  if (key.includes("cycle 1")) return [...CYCLE_1_NIVEAUX];

  return niveauxForCycle(cycle);
}

export function parseDocumentNiveaux(documentNiveau: string | null | undefined, cycle: string): SchoolNiveau[] {
  const raw = String(documentNiveau ?? "")
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const found = new Set<SchoolNiveau>();
  for (const part of raw) {
    for (const niveau of expandNiveauToSchoolLevels(part, cycle)) {
      found.add(niveau);
    }
  }

  if (found.size === 0) {
    for (const niveau of niveauxForCycle(cycle)) found.add(niveau);
  }

  return [...found];
}

export type CompetenceNiveauIdentity = {
  cycle: string;
  niveau: SchoolNiveau;
  matiere: string;
  domaine: string;
  sousDomaine: string;
  competence: string;
  sortKey: number;
};

/** Identifiant unique stable par compétence/niveau. */
export function buildCompetenceIdentifiant(input: CompetenceNiveauIdentity): string {
  const payload = [
    input.cycle,
    input.niveau,
    input.matiere,
    input.domaine,
    input.sousDomaine,
    input.competence,
    String(input.sortKey),
  ]
    .join("|")
    .toLowerCase();

  return `bo-${createHash("sha256").update(payload).digest("hex").slice(0, 16)}`;
}

export function niveauMatchesStrict(
  candidate: string | null | undefined,
  target: string | null | undefined,
): boolean {
  const normalizedTarget = normalizeSchoolNiveau(target);
  if (!normalizedTarget) return false;

  const normalizedCandidate = normalizeSchoolNiveau(candidate);
  if (!normalizedCandidate) return false;

  return normalizedCandidate === normalizedTarget;
}
