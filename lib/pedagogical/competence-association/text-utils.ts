import { createHash } from "node:crypto";

export function normalizeAssociationText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeAssociationText(value: string): string[] {
  const stopWords = new Set([
    "les",
    "des",
    "une",
    "dans",
    "pour",
    "avec",
    "plus",
    "sont",
    "etre",
    "être",
    "eleve",
    "élève",
    "eleves",
    "élèves",
    "cette",
    "cette",
    "comme",
    "sur",
    "par",
    "aux",
    "ses",
    "son",
    "sa",
    "leur",
    "leurs",
  ]);

  return normalizeAssociationText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

export function buildBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    bigrams.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return bigrams;
}

export function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  setA.forEach((token) => {
    if (setB.has(token)) intersection += 1;
  });

  return intersection / Math.max(setA.size, setB.size);
}

export function substringBoost(haystack: string, needle: string): number {
  const normalizedHaystack = normalizeAssociationText(haystack);
  const normalizedNeedle = normalizeAssociationText(needle);
  if (!normalizedNeedle || normalizedNeedle.length < 8) return 0;
  if (normalizedHaystack === normalizedNeedle) return 1;
  if (normalizedHaystack.includes(normalizedNeedle) || normalizedNeedle.includes(normalizedHaystack)) {
    return 0.92;
  }
  return 0;
}

export function hashContentProfile(text: string): string {
  return createHash("sha256").update(normalizeAssociationText(text)).digest("hex").slice(0, 24);
}

export function normalizeDiscipline(value: string | null | undefined): string {
  return normalizeAssociationText(String(value ?? ""));
}

export function disciplinesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const a = normalizeDiscipline(left);
  const b = normalizeDiscipline(right);
  if (!a || !b) return true;
  return a.includes(b) || b.includes(a);
}

export function niveauMatches(candidate: string | null | undefined, target: string | null | undefined): boolean {
  const normalizedCandidate = normalizeDiscipline(candidate);
  const normalizedTarget = normalizeDiscipline(target);
  if (!normalizedTarget) return true;
  if (!normalizedCandidate || normalizedCandidate === "non precise") return true;
  return normalizedCandidate === normalizedTarget;
}
