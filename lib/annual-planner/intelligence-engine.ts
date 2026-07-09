import type { PlannerAlert, PlannerPayload, PlannerSuggestion, PlannerWeek } from "./types";

export function analyzePlanner(payload: Pick<PlannerPayload, "weeks" | "competences" | "subjectHours">): {
  suggestions: PlannerSuggestion[];
  alerts: PlannerAlert[];
} {
  const suggestions: PlannerSuggestion[] = [];
  const alerts: PlannerAlert[] = [];

  const artsWeeks = payload.weeks.filter((week) =>
    week.badges.some((badge) => badge.subjectKey?.toLowerCase().includes("art")),
  );
  const period2Weeks = payload.weeks.filter((week) => week.periodNumber === 2);
  const artsInPeriod2 = period2Weeks.filter((week) =>
    week.badges.some((badge) => badge.label.toLowerCase().includes("art")),
  );

  if (period2Weeks.length > 0 && artsInPeriod2.length < 2) {
    suggestions.push({
      id: "arts-period-2",
      severity: "info",
      message: "La période 2 contient peu d'arts plastiques.",
    });
  }

  const evalWeeks = payload.weeks.filter((week) =>
    week.badges.some((badge) => badge.kind === "evaluation"),
  );
  if (evalWeeks.length === 1) {
    suggestions.push({
      id: "eval-cluster",
      severity: "warning",
      message: "Les évaluations sont regroupées sur une seule semaine.",
    });
  }

  const missingCompetences = payload.competences.filter((item) => item.status === "missing");
  if (missingCompetences.length > 0) {
    suggestions.push({
      id: "missing-competences",
      severity: "alert",
      message: `${missingCompetences.length} compétence(s) du BO ne sont jamais abordées.`,
    });
  }

  for (const subject of payload.subjectHours) {
    if (subject.delta < -2) {
      alerts.push({
        id: `hours-${subject.subject}`,
        code: "hours_deficit",
        message: `${subject.subject} : ${Math.abs(subject.delta)} semaine(s) en dessous de l'objectif.`,
      });
    }
    if (subject.delta > 2) {
      alerts.push({
        id: `hours-over-${subject.subject}`,
        code: "hours_excess",
        message: `${subject.subject} dépasse les horaires prévus.`,
      });
    }
  }

  const overloaded = payload.weeks.filter((week) => week.loadScore >= 8);
  if (overloaded.length > 0) {
    suggestions.push({
      id: "overloaded-weeks",
      severity: "warning",
      message: `${overloaded.length} semaine(s) semblent très chargées.`,
    });
  }

  const lightWeeks = payload.weeks.filter((week) => week.loadScore <= 1 && !week.isPast);
  if (lightWeeks.length >= 4) {
    suggestions.push({
      id: "light-weeks",
      severity: "info",
      message: "Plusieurs semaines à venir sont encore très légères — opportunité pour un projet.",
    });
  }

  const beforeVacation = findWeeksBeforeVacations(payload.weeks);
  for (const week of beforeVacation) {
    if (week.loadScore >= 6) {
      suggestions.push({
        id: `pre-vacation-${week.weekNumberInYear}`,
        severity: "warning",
        message: `La semaine ${week.weekNumberInYear} (avant vacances) est très chargée.`,
      });
    }
  }

  if (artsWeeks.length > 0 && evalWeeks.length > 0) {
    suggestions.push({
      id: "museum-timing",
      severity: "info",
      message: "Un projet musée pourrait être déplacé après la séquence sur l'impressionnisme.",
    });
  }

  for (const week of overloaded) {
    alerts.push({
      id: `overlap-${week.weekNumberInYear}`,
      code: "week_overload",
      message: `Semaine ${week.weekNumberInYear} : charge élevée (${week.loadScore} éléments).`,
      weekNumbers: [week.weekNumberInYear],
    });
  }

  return { suggestions, alerts };
}

function findWeeksBeforeVacations(weeks: PlannerWeek[]): PlannerWeek[] {
  const result: PlannerWeek[] = [];
  for (let index = 0; index < weeks.length - 1; index += 1) {
    const current = weeks[index];
    const next = weeks[index + 1];
    const gapDays =
      (new Date(next.startDate).getTime() - new Date(current.endDate).getTime()) /
      (1000 * 60 * 60 * 24);
    if (gapDays > 7) result.push(current);
  }
  return result;
}
