import type { ProgressionContext, ProgressionTab, ProgressionValidationResult } from "./types";
import { prerequisiteChecker } from "./PrerequisiteChecker";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Valide une progression avant affichage.
 */
export class ProgressionValidator {
  validate(tabs: ProgressionTab[], context: ProgressionContext): ProgressionValidationResult {
    const issues: ProgressionValidationResult["issues"] = [];
    const seenCompetences = new Map<string, string>();
    let duplicateCount = 0;
    let overloadedWeeks = 0;
    let prerequisiteViolations = 0;

    const expectedCompetences = new Set<string>();
    context.programmation.tables.forEach((table) => {
      table.periods.forEach((period) => {
        period.cell.competences.forEach((competence) => {
          expectedCompetences.add(normalize(competence));
        });
      });
    });

    const coveredCompetences = new Set<string>();

    tabs.forEach((tab) => {
      const weekLoads = new Map<string, number>();

      tab.rows.forEach((row) => {
        if (row.competenceBo) {
          const key = normalize(row.competenceBo);
          coveredCompetences.add(key);

          const existingTab = seenCompetences.get(key);
          if (existingTab && existingTab !== tab.subjectKey) {
            duplicateCount += 1;
            issues.push({
              code: "duplicate_competence",
              severity: "warning",
              message: `Compétence en doublon : ${row.competenceBo}`,
              tableKey: tab.subjectKey,
              periodNumber: row.periodNumber,
            });
          } else {
            seenCompetences.set(key, tab.subjectKey);
          }
        }

        const weekKey = `${row.periodNumber}-${row.weekNumber}`;
        weekLoads.set(weekKey, (weekLoads.get(weekKey) ?? 0) + 1);
      });

      weekLoads.forEach((count, weekKey) => {
        if (count > 5) {
          overloadedWeeks += 1;
          issues.push({
            code: "overloaded_week",
            severity: "warning",
            message: `Semaine surchargée (${weekKey}) : ${count} séances.`,
            tableKey: tab.subjectKey,
          });
        }
      });

      const learningItems = tab.rows.map((row, index) => ({
        id: row.learningItemId ?? `row-${index}`,
        type: "competence" as const,
        label: row.competenceBo || row.sequenceModule,
        order: index,
        referentielId: row.referentielIds[0],
        prerequisiteIds: [],
      }));

      prerequisiteChecker.check(learningItems).forEach((violation) => {
        prerequisiteViolations += 1;
        issues.push({
          code: "prerequisite_violation",
          severity: "error",
          message: violation.message,
          tableKey: tab.subjectKey,
        });
      });
    });

    expectedCompetences.forEach((competence) => {
      if (!coveredCompetences.has(competence)) {
        issues.push({
          code: "missing_competence",
          severity: "error",
          message: `Compétence de la programmation non couverte : ${competence}`,
        });
      }
    });

    const totalRows = tabs.reduce((sum, tab) => sum + tab.rows.length, 0);
    const filledRows = tabs.reduce(
      (sum, tab) =>
        sum + tab.rows.filter((row) => row.competenceBo || row.deroulement).length,
      0,
    );

    const completionRate = totalRows > 0 ? filledRows / totalRows : 0;
    const balanceScore = this.computeBalance(tabs);

    if (balanceScore < 0.5) {
      issues.push({
        code: "annual_balance",
        severity: "warning",
        message: "La répartition annuelle semble déséquilibrée.",
      });
    }

    const hasErrors = issues.some((issue) => issue.severity === "error");

    return {
      valid: !hasErrors,
      issues,
      summary: {
        totalCompetences: expectedCompetences.size,
        coveredCompetences: coveredCompetences.size,
        duplicateCount,
        overloadedWeeks,
        prerequisiteViolations,
        balanceScore,
        completionRate: Number(completionRate.toFixed(2)),
      },
    };
  }

  private computeBalance(tabs: ProgressionTab[]): number {
    const periodCounts = new Map<number, number>();

    tabs.forEach((tab) => {
      tab.rows.forEach((row) => {
        periodCounts.set(row.periodNumber, (periodCounts.get(row.periodNumber) ?? 0) + 1);
      });
    });

    const counts = [...periodCounts.values()];
    if (counts.length === 0) return 1;

    const average = counts.reduce((sum, value) => sum + value, 0) / counts.length;
    const variance =
      counts.reduce((sum, value) => sum + (value - average) ** 2, 0) / counts.length;

    return Number(Math.max(0, 1 - variance / Math.max(average, 1)).toFixed(2));
  }
}

export const progressionValidator = new ProgressionValidator();

export function buildProgressionValidationReport(
  validation: ProgressionValidationResult,
): string {
  if (validation.valid && validation.issues.length === 0) {
    return "Progression validée.";
  }

  return validation.issues
    .map(
      (issue) =>
        `${issue.severity === "error" ? "Erreur" : "Avertissement"} : ${issue.message}`,
    )
    .join("\n");
}
