import type { LearningItem } from "./types";

export type PrerequisiteViolation = {
  itemId: string;
  label: string;
  missingPrerequisite: string;
  message: string;
};

/**
 * Vérifie que les prérequis pédagogiques sont respectés dans l'ordre des apprentissages.
 */
export class PrerequisiteChecker {
  check(items: LearningItem[]): PrerequisiteViolation[] {
    const violations: PrerequisiteViolation[] = [];
    const seenLabels = new Set<string>();
    const seenCodes = new Set<string>();

    items.forEach((item) => {
      const normalized = item.label.toLowerCase();

      item.prerequisiteIds?.forEach((prerequisiteId) => {
        const code = prerequisiteId.replace(/^code:/, "");
        if (code && !seenCodes.has(code)) {
          violations.push({
            itemId: item.id,
            label: item.label,
            missingPrerequisite: code,
            message: `La compétence « ${item.label} » est placée avant son prérequis (${code}).`,
          });
        }
      });

      if (/après|suite de|prérequis/i.test(item.label)) {
        const match = item.label.match(/après\s+(.+)$/i);
        if (match?.[1]) {
          const prerequisiteLabel = match[1].trim().toLowerCase();
          if (![...seenLabels].some((seen) => seen.includes(prerequisiteLabel))) {
            violations.push({
              itemId: item.id,
              label: item.label,
              missingPrerequisite: match[1],
              message: `Prérequis manquant pour « ${item.label} ».`,
            });
          }
        }
      }

      seenLabels.add(normalized);
      if (item.referentielId) {
        seenCodes.add(item.id);
      }
    });

    return violations;
  }

  isValid(items: LearningItem[]): boolean {
    return this.check(items).length === 0;
  }
}

export const prerequisiteChecker = new PrerequisiteChecker();
