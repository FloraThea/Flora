import { detectSchoolNiveauFromLine } from "../niveau-utils";

const LEVEL_PATTERNS: Array<{ pattern: RegExp; niveau: string }> = [
  { pattern: /^cours preparatoire$/i, niveau: "CP" },
  { pattern: /^cours elementaire premiere annee$/i, niveau: "CE1" },
  { pattern: /^cours elementaire 1(?:re|ere)? annee$/i, niveau: "CE1" },
  { pattern: /^cours elementaire deuxieme annee$/i, niveau: "CE2" },
  { pattern: /^cours elementaire 2(?:e|eme)? annee$/i, niveau: "CE2" },
  { pattern: /^cours moyen premiere annee$/i, niveau: "CM1" },
  { pattern: /^cours moyen deuxieme annee$/i, niveau: "CM2" },
];

const DOMAIN_HEADINGS = [
  /^nombres, calcul et resolution de problemes$/i,
  /^grandeurs et mesures$/i,
  /^espace et geometrie$/i,
  /^organisation et gestion de donnees$/i,
  /^langage oral$/i,
  /^lecture et comprehension(?: de l.ecrit)?$/i,
  /^lecture$/i,
  /^ecriture$/i,
  /^oral$/i,
  /^etude de la langue$/i,
  /^culture litteraire(?: et artistique)?$/i,
  /^vocabulaire$/i,
];

const SKIP_HEADING_PATTERNS = [
  /^objectifs d.apprentissage/i,
  /^exemples de reussite/i,
  /^sommaire$/i,
  /^principes$/i,
  /^frequence des temps/i,
  /^tous les jours/i,
  /^toutes les semaines/i,
  /^dans l.annee/i,
  /^programme de /i,
  /^enseignements primaire/i,
];

const PERIOD_MARKER =
  /^(des les premieres semaines|des la periode \d|a la fin de l.annee|a l.issue de la periode \d|au cours des periodes|en fin d.annee|dès la période|à la fin de l'année)/i;

const EXAMPLE_START =
  /^(l.elève|les collections|face a|a la fin du cp|il |elle |exemple\s*:|→|les élèves|toute l.année|au plus tard)/i;

export function normalizeBoLine(line: string): string {
  return line
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeBoKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019\u201A\u2032\u2035''`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function detectNiveauFromLine(line: string): string | null {
  return detectSchoolNiveauFromLine(line);
}

function stripNiveauDecorators(line: string): string {
  return normalizeBoKey(line)
    .replace(/^[\u2192\u279c\u27a1\u27a4➜\-•·\u2022\s]+/, "")
    .trim();
}

export function isDomainHeading(line: string): boolean {
  const key = normalizeBoKey(line);
  return DOMAIN_HEADINGS.some((pattern) => pattern.test(key) && key.length <= 60);
}

export function isSubdomainHeading(line: string, matiere: string): boolean {
  const trimmed = normalizeBoLine(line);
  if (!trimmed || trimmed.length > 70) return false;
  const key = normalizeBoKey(trimmed);
  if (SKIP_HEADING_PATTERNS.some((pattern) => pattern.test(key))) return false;
  if (detectNiveauFromLine(trimmed)) return false;
  if (isDomainHeading(trimmed)) return false;
  if (trimmed.startsWith("-")) return false;
  if (/^[•]/.test(trimmed)) return false;
  if (PERIOD_MARKER.test(key)) return false;
  if (/[.!?]/.test(trimmed)) return false;
  if (/[()]/.test(trimmed)) return false;
  if (/\b(élève|eleve|peuvent|peut|sont|collections)\b/i.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 12) return false;

  if (matiere === "Mathématiques") {
    return /^(les |la |le |l'|memoriser|utiliser|apprendre|la resolution)/i.test(trimmed);
  }

  return /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(trimmed) && trimmed.length >= 8;
}

export function isObjectifsTableHeader(line: string): boolean {
  const key = normalizeBoKey(line);
  return key.includes("objectifs d'apprentissage") && key.includes("exemples de reussite");
}

export function isConnaissancesTableHeader(line: string): boolean {
  const key = normalizeBoKey(line);
  return (
    key.includes("connaissances et competences associees") ||
    (key.includes("competence principale") && key.includes("connaissances"))
  );
}

export function isNotionsCompetencesHeader(line: string): boolean {
  const key = normalizeBoKey(line);
  return key.includes("notions et competences") && !key.startsWith("objectif");
}

export function isEmcConnaissancesHeader(line: string): boolean {
  const key = normalizeBoKey(line);
  return (
    (key.includes("connaissances et competences") && key.includes("objets")) ||
    key === "connaissances et competences" ||
    key.startsWith("connaissances et competences associees") ||
    key.startsWith("associees objets d'enseignement")
  );
}

export function isEmcConnaissancesHeaderContinuation(line: string, previousLine: string): boolean {
  const key = normalizeBoKey(line);
  const previousKey = normalizeBoKey(previousLine);
  return (
    key.startsWith("associees objets d'enseignement") &&
    previousKey.includes("connaissances et competences")
  );
}

export function isEmcAttendusHeader(line: string): boolean {
  return /^attendus de fin de cycle/i.test(normalizeBoKey(line));
}

export function isEmcDomainHeading(line: string): boolean {
  const key = normalizeBoKey(line)
    .replace(/^\d+\)\s*/, "")
    .replace(/^[•·\u2022]\s*/, "");
  return (
    key.startsWith("respecter autrui") ||
    key.startsWith("acquerir et partager les valeurs") ||
    key.startsWith("construire une culture civique") ||
    key.startsWith("le respect d'autrui") ||
    key.startsWith("identifier et partager des emotions") ||
    key.startsWith("respecter les regles de la vie collective")
  );
}

export function isEmcObjetEnseignementLine(line: string): boolean {
  const trimmed = normalizeBoLine(line);
  if (!trimmed || trimmed.length > 120) return false;
  if (isCompetenceBullet(trimmed)) return false;
  return /^(le |la |les |l'|une |un |des |initiation |experience |connaissance |les droits)/i.test(trimmed);
}

export function isEmcCompetenceProseLine(line: string): boolean {
  const trimmed = normalizeBoLine(line);
  if (!trimmed || trimmed.length < 12 || trimmed.length > 180) return false;
  if (isCompetenceBullet(trimmed)) return false;
  if (isEmcObjetEnseignementLine(trimmed)) return false;
  if (isExampleParagraph(trimmed)) return false;
  if (/^©|^programme|^connaissances et|^objets d|^tout au long|^les eleves|^une initiation|^les valeurs/i.test(trimmed)) {
    return false;
  }
  return /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(trimmed);
}

export function isEvarObjectifLine(line: string): boolean {
  const key = normalizeBoKey(line);
  return /objectif d'apprentissage\s*:/.test(key);
}

export function isEvarDomainHeading(line: string): boolean {
  const key = normalizeBoKey(line);
  return (
    key.startsWith("se connaitre, vivre et") ||
    key.startsWith("rencontrer les autres") ||
    key.startsWith("trouver sa place dans la societe")
  );
}

export function detectShortNiveauFromLine(line: string): string | null {
  return detectSchoolNiveauFromLine(line);
}

export function detectEvarNiveauFromContext(line: string): string | null {
  const trimmed = normalizeBoLine(line);
  if (/^cycle 2$/i.test(trimmed)) return "Cycle 2";
  if (/^cycle 3$/i.test(trimmed)) return "Cycle 3";
  const school = detectSchoolNiveauFromLine(trimmed);
  if (school) return school;
  const key = stripNiveauDecorators(line);
  for (const entry of LEVEL_PATTERNS) {
    if (entry.pattern.test(key)) return entry.niveau;
  }
  return null;
}

export function isCompetenceBullet(line: string): boolean {
  const trimmed = normalizeBoLine(line);
  return trimmed.startsWith("-") || /^[•]/.test(trimmed);
}

export function cleanBulletText(line: string): string {
  return normalizeBoLine(line.replace(/^[-•]\s*/, ""));
}

export function isExampleParagraph(line: string): boolean {
  const trimmed = normalizeBoLine(line);
  if (!trimmed) return false;
  return EXAMPLE_START.test(trimmed);
}

export function isPeriodMarker(line: string): boolean {
  return PERIOD_MARKER.test(normalizeBoKey(line));
}

export function findIntroductionSplitIndex(text: string): number {
  const tableStart =
    /Objectifs d[''\u2019]apprentissage\s+Exemples de r[eéè]ussite|Fr[eéè]quence des temps d[''\u2019]apprentissage|Connaissances et comp[eé]tences associ[eé]es|Comp[eé]tence principale|Objectifs d[''\u2019]apprentissage pour chaque niveau|Notions et comp[eé]tences\s+Propositions|Attendus de fin de cycle|Connaissances et comp[eé]tences\s+Objets d[''\u2019]enseignement/i;
  const match = text.match(tableStart);
  if (match?.index !== undefined && match.index >= 0) {
    return match.index;
  }

  const fallback = text.search(/Objectifs d[''\u2019]apprentissage|Notions et comp[eé]tences/i);
  return fallback >= 0 ? fallback : text.length;
}

export function isCompetenceCandidateBullet(line: string): boolean {
  if (!isCompetenceBullet(line)) return false;
  const cleaned = cleanBulletText(line);
  return cleaned.length >= 8 && !isExampleParagraph(cleaned);
}

export function mergeMultilineBullet(lines: string[], startIndex: number): { text: string; endIndex: number } {
  let text = cleanBulletText(lines[startIndex] ?? "");
  let index = startIndex + 1;

  while (index < lines.length) {
    const next = normalizeBoLine(lines[index] ?? "");
    if (!next) break;
    if (isCompetenceBullet(next)) break;
    if (isObjectifsTableHeader(next)) break;
    if (detectNiveauFromLine(next)) break;
    if (isDomainHeading(next)) break;
    if (isSubdomainHeading(next, "")) break;
    if (isExampleParagraph(next)) break;
    if (isPeriodMarker(next)) break;
    if (next.length > 140) break;

    text = `${text} ${next}`.replace(/\s+/g, " ").trim();
    index += 1;
  }

  return { text, endIndex: index - 1 };
}
