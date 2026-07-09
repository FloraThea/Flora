import type {
  CalendarSnapshot,
  PlannerContext,
  ProgrammingTable,
  ValidationIssue,
  ValidationResult,
} from "./types";

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Valide une programmation avant affichage.
 */
export class ProgrammingValidator {
  validate(
    tables: ProgrammingTable[],
    context: PlannerContext,
  ): ValidationResult {
    const issues: ValidationIssue[] = [];
    const referentielSet = new Set(
      context.referentiel.map((item) => normalize(item.competence)),
    );

    const allCompetences: string[] = [];
    const seenCompetences = new Map<string, string>();

    tables.forEach((table) => {
      table.periods.forEach((period) => {
        period.cell.competences.forEach((competence) => {
          allCompetences.push(competence);

          const key = normalize(competence);
          const existing = seenCompetences.get(key);
          if (existing && existing !== table.subjectKey) {
            issues.push({
              code: "duplicate_competence",
              severity: "warning",
              message: `Compétence en doublon : ${competence}`,
              tableKey: table.subjectKey,
              periodNumber: period.periodNumber,
            });
          } else {
            seenCompetences.set(key, table.subjectKey);
          }

          if (referentielSet.size > 0 && !this.matchesReferentiel(competence, context)) {
            issues.push({
              code: "unknown_competence",
              severity: "warning",
              message: `Compétence absente du BO importé : ${competence}`,
              tableKey: table.subjectKey,
              periodNumber: period.periodNumber,
            });
          }
        });

        if (
          period.cell.competences.length === 0 &&
          period.cell.content.trim().length === 0 &&
          period.cell.notions.length === 0
        ) {
          issues.push({
            code: "empty_period",
            severity: "warning",
            message: `Période ${period.periodNumber} vide pour ${table.subSubjectLabel || table.subjectLabel}`,
            tableKey: table.subjectKey,
            periodNumber: period.periodNumber,
          });
        }
      });
    });

    const unusedWeeks = this.computeUnusedWeeks(tables, context.calendar);
    if (unusedWeeks > 0.5) {
      issues.push({
        code: "unused_weeks",
        severity: "warning",
        message: `${unusedWeeks.toFixed(1)} semaine(s) semblent sous-utilisées dans la programmation.`,
      });
    }

    const loadBalanceScore = this.computeLoadBalance(tables, context.calendar);
    if (loadBalanceScore < 0.55) {
      issues.push({
        code: "unbalanced_load",
        severity: "warning",
        message: "La charge entre périodes semble déséquilibrée.",
      });
    }

    const coveredCompetences = new Set(
      allCompetences.map((competence) => normalize(competence)),
    ).size;

    const missingFromReferentiel = context.referentiel.filter(
      (item) => !seenCompetences.has(normalize(item.competence)),
    );

    if (missingFromReferentiel.length > 0 && referentielSet.size > 0) {
      issues.push({
        code: "missing_competences",
        severity: "error",
        message: `${missingFromReferentiel.length} compétence(s) du BO ne sont pas encore couvertes.`,
      });
    }

    const duplicateCount = issues.filter(
      (issue) => issue.code === "duplicate_competence",
    ).length;

    const hasErrors = issues.some((issue) => issue.severity === "error");

    return {
      valid: !hasErrors,
      issues,
      summary: {
        totalCompetences: referentielSet.size || coveredCompetences,
        coveredCompetences,
        duplicateCount,
        unusedWeeks,
        loadBalanceScore,
      },
    };
  }

  private matchesReferentiel(competence: string, context: PlannerContext): boolean {
    const normalized = normalize(competence);
    return context.referentiel.some((item) => {
      const candidate = normalize(item.competence);
      return (
        candidate === normalized ||
        candidate.includes(normalized) ||
        normalized.includes(candidate)
      );
    });
  }

  private computeUnusedWeeks(
    tables: ProgrammingTable[],
    calendar: CalendarSnapshot,
  ): number {
    const filledPeriods = new Set<number>();

    tables.forEach((table) => {
      table.periods.forEach((period) => {
        const hasContent =
          period.cell.competences.length > 0 ||
          period.cell.notions.length > 0 ||
          period.cell.content.trim().length > 0;
        if (hasContent) filledPeriods.add(period.periodNumber);
      });
    });

    return calendar.periods
      .filter((period) => !filledPeriods.has(period.periodNumber))
      .reduce((sum, period) => sum + period.workingWeeks, 0);
  }

  private computeLoadBalance(
    tables: ProgrammingTable[],
    calendar: CalendarSnapshot,
  ): number {
    const loads = calendar.periods.map((period) => {
      const contentCount = tables.reduce((sum, table) => {
        const column = table.periods.find(
          (item) => item.periodNumber === period.periodNumber,
        );
        if (!column) return sum;
        return (
          sum +
          column.cell.competences.length +
          column.cell.notions.length +
          (column.cell.content.trim() ? 1 : 0)
        );
      }, 0);

      return contentCount / Math.max(period.workingWeeks, 1);
    });

    if (loads.length === 0) return 1;

    const average = loads.reduce((sum, value) => sum + value, 0) / loads.length;
    const variance =
      loads.reduce((sum, value) => sum + (value - average) ** 2, 0) /
      loads.length;

    return Number(Math.max(0, 1 - variance).toFixed(2));
  }
}

export const programmingValidator = new ProgrammingValidator();
