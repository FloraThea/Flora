import type {
  AssociationSignals,
  BoCompetenceCandidate,
  ContentProfile,
  PedagogicalContentInput,
} from "./types";
import {
  disciplinesMatch,
  jaccardSimilarity,
  normalizeAssociationText,
  normalizeDiscipline,
  substringBoost,
  tokenizeAssociationText,
} from "./text-utils";

const SIGNAL_WEIGHTS = {
  textSimilarity: 0.45,
  hierarchyMatch: 0.25,
  explicitLabel: 0.2,
  methodContext: 0.05,
  feedbackBoost: 0.05,
} as const;

function moduleNumberFromLabel(label: string): number | null {
  const match = label.match(/module\s+(\d+)/i);
  return match ? Number.parseInt(match[1] ?? "0", 10) : null;
}

function scoreHierarchy(profile: ContentProfile, candidate: BoCompetenceCandidate, input: PedagogicalContentInput): number {
  let score = 0;
  const haystack = normalizeAssociationText(
    [profile.fullText, input.sousMatiere, input.moduleLabel, input.seanceLabel].filter(Boolean).join(" "),
  );

  const hierarchyParts = [
    candidate.domaine,
    candidate.sousDomaine,
    candidate.section,
  ].filter(Boolean) as string[];

  for (const part of hierarchyParts) {
    const normalized = normalizeAssociationText(part);
    if (normalized.length < 4) continue;
    if (haystack.includes(normalized)) {
      score = Math.max(score, part === candidate.sousDomaine ? 1 : 0.85);
    } else {
      const tokens = tokenizeAssociationText(part);
      const overlap = jaccardSimilarity(profile.tokens, tokens);
      score = Math.max(score, overlap * 0.75);
    }
  }

  return Number(score.toFixed(3));
}

function scoreExplicitLabels(input: PedagogicalContentInput, candidate: BoCompetenceCandidate): number {
  const labels = [...(input.competences ?? []), input.title ?? ""].filter(Boolean);
  let best = 0;

  for (const label of labels) {
    best = Math.max(best, substringBoost(candidate.competence, label));
    if (candidate.code) {
      best = Math.max(best, substringBoost(label, candidate.code));
    }
  }

  return Number(best.toFixed(3));
}

function scoreMethodContext(input: PedagogicalContentInput, candidate: BoCompetenceCandidate): number {
  const methode = normalizeDiscipline(input.methode);
  if (!methode.includes("mhm")) return 0;

  const moduleNumber = moduleNumberFromLabel(input.moduleLabel ?? input.title ?? "");
  if (!moduleNumber) return 0;

  const candidateText = normalizeAssociationText(
    [candidate.competence, candidate.domaine, candidate.sousDomaine, candidate.sourceExcerpt].filter(Boolean).join(" "),
  );

  const moduleHints: Record<number, string[]> = {
    1: ["numeration", "nombre", "compter", "dizaine", "unite"],
    2: ["addition", "soustraction", "calcul", "operation"],
    3: ["multiplication", "produit", "table"],
    4: ["division", "partager", "quotient"],
    5: ["fraction", "partie"],
    6: ["probleme", "resolution", "situation"],
    7: ["geometrie", "figure", "solide", "plan"],
    8: ["mesure", "longueur", "masse", "duree"],
  };

  const hints = moduleHints[moduleNumber] ?? [];
  if (hints.length === 0) return 0;

  let hits = 0;
  for (const hint of hints) {
    if (candidateText.includes(hint)) hits += 1;
  }

  return Number(Math.min(1, hits / Math.max(2, hints.length)).toFixed(3));
}

function scoreTextSimilarity(profile: ContentProfile, candidate: BoCompetenceCandidate): number {
  const candidateTokens = tokenizeAssociationText(
    [candidate.competence, candidate.sourceExcerpt, candidate.domaine, candidate.sousDomaine]
      .filter(Boolean)
      .join(" "),
  );

  const tokenScore = jaccardSimilarity(profile.tokens, candidateTokens);
  const bigramScore = jaccardSimilarity(profile.bigrams, buildBigrams(candidateTokens));
  const exactBoost = substringBoost(profile.fullText, candidate.competence);

  return Number(Math.max(exactBoost, tokenScore * 0.72 + bigramScore * 0.28).toFixed(3));
}

function buildBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    bigrams.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return bigrams;
}

export function scoreCompetenceCandidate(input: {
  profile: ContentProfile;
  candidate: BoCompetenceCandidate;
  content: PedagogicalContentInput;
  feedbackBoost?: number;
}): { confidence: number; signals: AssociationSignals } {
  const signals: AssociationSignals = {
    textSimilarity: scoreTextSimilarity(input.profile, input.candidate),
    hierarchyMatch: scoreHierarchy(input.profile, input.candidate, input.content),
    explicitLabel: scoreExplicitLabels(input.content, input.candidate),
    methodContext: scoreMethodContext(input.content, input.candidate),
    feedbackBoost: Number(Math.min(1, input.feedbackBoost ?? 0).toFixed(3)),
  };

  const weighted = Number(
    (
      signals.textSimilarity * SIGNAL_WEIGHTS.textSimilarity +
      signals.hierarchyMatch * SIGNAL_WEIGHTS.hierarchyMatch +
      signals.explicitLabel * SIGNAL_WEIGHTS.explicitLabel +
      signals.methodContext * SIGNAL_WEIGHTS.methodContext +
      signals.feedbackBoost * SIGNAL_WEIGHTS.feedbackBoost
    ).toFixed(3),
  );

  let confidence = weighted;
  if (signals.explicitLabel >= 0.9) {
    confidence = Math.max(confidence, 0.78);
  } else if (signals.textSimilarity >= 0.6) {
    confidence = Math.max(confidence, 0.65);
  }

  return { confidence: Number(confidence.toFixed(3)), signals };
}

export function buildProposalExplanation(signals: AssociationSignals, candidate: BoCompetenceCandidate): string {
  const reasons: string[] = [];

  if (signals.explicitLabel >= 0.9) {
    reasons.push("correspondance directe avec une compétence mentionnée dans le document");
  } else if (signals.textSimilarity >= 0.55) {
    reasons.push("forte proximité sémantique avec le contenu pédagogique analysé");
  } else if (signals.textSimilarity >= 0.35) {
    reasons.push("plusieurs termes clés communs avec la séance");
  }

  if (signals.hierarchyMatch >= 0.7 && candidate.domaine) {
    reasons.push(`cohérence avec le domaine « ${candidate.domaine} »`);
  }

  if (signals.methodContext >= 0.4) {
    reasons.push("alignement avec la progression de la méthode");
  }

  if (signals.feedbackBoost >= 0.4) {
    reasons.push("choix déjà validé par l'enseignant sur un contenu similaire");
  }

  if (reasons.length === 0) {
    return "Proposition basée sur l'analyse globale du contenu pédagogique.";
  }

  return reasons.join(" ; ") + ".";
}

export function proposalStatus(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.55) return "medium";
  return "low";
}

export function filterCandidates(
  candidates: BoCompetenceCandidate[],
  input: PedagogicalContentInput,
): BoCompetenceCandidate[] {
  return candidates.filter((candidate) => {
    if (!disciplinesMatch(candidate.discipline, input.matiere)) return false;
    return niveauMatches(candidate.niveau, input.niveau);
  });
}

function niveauMatches(candidate: string | null | undefined, target: string | null | undefined): boolean {
  const normalizedCandidate = normalizeDiscipline(candidate);
  const normalizedTarget = normalizeDiscipline(target);
  if (!normalizedTarget) return true;
  if (!normalizedCandidate || normalizedCandidate === "non precise") return true;
  return normalizedCandidate === normalizedTarget;
}
