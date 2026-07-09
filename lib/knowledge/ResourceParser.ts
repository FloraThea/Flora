import type { ParsedResource } from "./types";
import { DOCUMENT_TYPE_CANDIDATES } from "./types";

const TYPE_PATTERNS: Array<{
  type: string;
  patterns: RegExp[];
  weight: number;
}> = [
  {
    type: "BO",
    patterns: [/bulletin officiel/i, /\bBO\b/, /programme officiel/i, /compétence/i],
    weight: 0.9,
  },
  {
    type: "guide du maître",
    patterns: [/guide du ma[iî]tre/i, /guide p[eé]dagogique/i, /mhm/i],
    weight: 0.85,
  },
  {
    type: "album",
    patterns: [/album/i, /illustration/i, /personnage/i, /narramus/i],
    weight: 0.8,
  },
  {
    type: "séquence",
    patterns: [/s[eé]quence/i, /s[eé]ance/i, /d[eé]roul[eé]/i],
    weight: 0.75,
  },
  {
    type: "programmation",
    patterns: [/programmation/i, /p[eé]riode \d/i],
    weight: 0.75,
  },
  {
    type: "progression",
    patterns: [/progression/i, /progressif/i],
    weight: 0.75,
  },
  {
    type: "cahier journal",
    patterns: [/cahier journal/i, /journal de classe/i],
    weight: 0.8,
  },
  {
    type: "fichier d'exercices",
    patterns: [/exercice/i, /fiche d'exercice/i, /worksheet/i],
    weight: 0.7,
  },
  {
    type: "manuel",
    patterns: [/manuel/i, /unit[eé] \d/i, /le[cç]on \d/i],
    weight: 0.7,
  },
];

const HIERARCHY_TEMPLATES: Record<string, string[]> = {
  BO: ["domaine", "sous_domaine", "competence", "attendu"],
  "guide du maître": ["module", "seance", "objectif", "activite"],
  album: ["personnage", "lexique", "comprehension", "activite"],
  séquence: ["sequence", "seance", "activite", "objectif"],
  narramus: ["sequence", "seance", "activite"],
};

/**
 * Identifie le type de ressource et la hiérarchie probable du document.
 */
export class ResourceParser {
  parse(text: string, filename: string, suggestedType = ""): ParsedResource {
    const haystack = `${filename}\n${text.slice(0, 8000)}`.toLowerCase();
    let bestType = suggestedType || "ressource personnelle";
    let bestScore = suggestedType ? 0.65 : 0.35;
    const signals: string[] = [];

    for (const candidate of TYPE_PATTERNS) {
      const matches = candidate.patterns.filter((pattern) => pattern.test(haystack));
      if (matches.length === 0) continue;

      const score = Math.min(
        0.98,
        candidate.weight + matches.length * 0.04,
      );

      if (score > bestScore) {
        bestScore = score;
        bestType = candidate.type;
        signals.push(...matches.map((pattern) => pattern.source));
      }
    }

    if (/narramus/i.test(haystack)) {
      bestType = "séquence";
      bestScore = Math.max(bestScore, 0.82);
      signals.push("narramus");
    }

    const hierarchyTemplate =
      HIERARCHY_TEMPLATES[bestType] ??
      (bestType === "guide du maître"
        ? HIERARCHY_TEMPLATES["guide du maître"]
        : ["section", "objectif", "activite"]);

    return {
      documentType: DOCUMENT_TYPE_CANDIDATES.includes(
        bestType as (typeof DOCUMENT_TYPE_CANDIDATES)[number],
      )
        ? bestType
        : "ressource personnelle",
      confidence: Number(bestScore.toFixed(2)),
      hierarchyTemplate,
      signals: [...new Set(signals)],
    };
  }

  /** Point d'extension pour des stratégies spécifiques par éditeur. */
  getHierarchyForType(documentType: string): string[] {
    return (
      HIERARCHY_TEMPLATES[documentType] ?? ["section", "objectif", "activite"]
    );
  }
}

export const resourceParser = new ResourceParser();
