const TYPE_RULES: Array<{ type: string; patterns: RegExp[] }> = [
  { type: "guide du maître", patterns: [/guide\s+(du\s+)?ma[iî]tre/i, /guide\s+p[eé]dagogique/i] },
  { type: "programmation", patterns: [/programmation/i] },
  { type: "progression", patterns: [/progression/i] },
  { type: "BO", patterns: [/bulletin\s+officiel|\bBO\b/i] },
  { type: "évaluation", patterns: [/évaluation|evaluation/i] },
  { type: "album", patterns: [/album/i] },
  { type: "manuel", patterns: [/manuel/i] },
  { type: "séquence", patterns: [/s[eé]quence/i] },
  { type: "séance", patterns: [/s[eé]ance/i] },
  { type: "ressource pédagogique", patterns: [/ressource/i] },
];

export class DocumentClassifier {
  classify(input: {
    filename: string;
    text: string;
    currentType?: string;
  }): string {
    if (input.currentType?.trim()) return input.currentType;
    const haystack = `${input.filename}\n${input.text.slice(0, 6000)}`;

    for (const rule of TYPE_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(haystack))) {
        return rule.type;
      }
    }

    return "ressource pédagogique";
  }
}

export const documentClassifier = new DocumentClassifier();
