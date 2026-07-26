import type { ContentProfile, PedagogicalContentInput } from "./types";
import { buildBigrams, hashContentProfile, tokenizeAssociationText } from "./text-utils";

function joinParts(parts: Array<string | undefined | null>): string {
  return parts
    .flatMap((part) => (part ? [part.trim()] : []))
    .filter(Boolean)
    .join("\n");
}

export function buildContentProfile(input: PedagogicalContentInput): ContentProfile {
  const weightedSegments = [
    { text: input.title ?? "", weight: 1.4, label: "titre" },
    { text: input.theme ?? "", weight: 1.2, label: "thème" },
    { text: joinParts(input.competences ?? []), weight: 1.5, label: "compétences importées" },
    { text: joinParts(input.objectifs ?? []), weight: 1.35, label: "objectifs" },
    { text: joinParts(input.notions ?? []), weight: 1.1, label: "notions" },
    { text: input.deroulement ?? "", weight: 1.25, label: "déroulement" },
    { text: joinParts(input.activites ?? []), weight: 1.15, label: "activités" },
    { text: joinParts(input.materiel ?? []), weight: 0.7, label: "matériel" },
    { text: joinParts(input.ressources ?? []), weight: 0.8, label: "ressources" },
    { text: input.moduleLabel ?? "", weight: 1.1, label: "module" },
    { text: input.seanceLabel ?? "", weight: 1.05, label: "séance" },
    { text: input.sousMatiere ?? "", weight: 1.0, label: "sous-matière" },
    { text: input.libraryContent ?? "", weight: 1.3, label: "contenu guide" },
    { text: input.evaluation ?? "", weight: 0.9, label: "évaluation" },
    { text: input.differenciation ?? "", weight: 0.75, label: "différenciation" },
  ].filter((segment) => segment.text.trim().length > 0);

  const fullText = weightedSegments
    .flatMap((segment) => Array.from({ length: Math.max(1, Math.round(segment.weight)) }, () => segment.text))
    .join("\n");

  const tokens = tokenizeAssociationText(fullText);
  const bigrams = buildBigrams(tokens);

  return {
    fullText,
    weightedSegments,
    contentHash: hashContentProfile(fullText),
    tokens,
    bigrams,
  };
}
