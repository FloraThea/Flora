import type { JournalEntry, JournalPayload, StoredJournal } from "./types";

export type JournalValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
};

export class JournalValidator {
  validate(payload: JournalPayload): JournalValidationIssue[] {
    const issues: JournalValidationIssue[] = [];

    if (!payload.journal.journalDate) {
      issues.push({
        code: "missing_date",
        severity: "error",
        message: "La date du cahier journal est obligatoire.",
      });
    }

    if (payload.entries.length === 0) {
      issues.push({
        code: "empty_day",
        severity: "warning",
        message: "Aucun créneau horaire n'a pu être assemblé pour cette journée.",
      });
    }

    const withoutSeance = payload.entries.filter(
      (entry) => entry.entryType === "slot" && !entry.seanceId,
    );
    if (withoutSeance.length > 0) {
      issues.push({
        code: "slots_without_seance",
        severity: "warning",
        message: `${withoutSeance.length} créneau(x) sans séance associée.`,
      });
    }

    return issues;
  }

  assertReady(payload: JournalPayload): void {
    const errors = this.validate(payload).filter((issue) => issue.severity === "error");
    if (errors.length > 0) {
      throw new Error(errors.map((issue) => issue.message).join(" "));
    }
  }
}

export const journalValidator = new JournalValidator();

export function computeDashboard(entries: JournalEntry[]): StoredJournal["dashboard"] {
  const lessonEntries = entries.filter((entry) => entry.entryType === "slot");
  const ritualEntries = entries.filter((entry) => entry.entryType === "ritual");
  const plannedMinutes = entries.reduce((sum, entry) => sum + entry.dureeMinutes, 0);
  const actualMinutes = entries.reduce(
    (sum, entry) => sum + (entry.observation?.actualMinutes ?? 0),
    0,
  );
  const completedSessions = lessonEntries.filter(
    (entry) => entry.observation?.status === "realisee",
  ).length;
  const completedRituals = ritualEntries.filter(
    (entry) => entry.observation?.status === "realisee",
  ).length;
  const workedCompetences = [
    ...new Set(
      lessonEntries
        .filter((entry) => entry.observation?.status !== "non_realisee")
        .map((entry) => entry.competence)
        .filter(Boolean),
    ),
  ];
  const remainingCompetences = [
    ...new Set(
      lessonEntries
        .filter((entry) => !entry.observation || entry.observation.status === "non_realisee")
        .map((entry) => entry.competence)
        .filter(Boolean),
    ),
  ];

  return {
    plannedMinutes,
    actualMinutes,
    completedSessions,
    remainingSessions: Math.max(0, lessonEntries.length - completedSessions),
    completedRituals,
    workedCompetences,
    remainingCompetences,
    periodProgressPercent: 0,
    annualProgressPercent: 0,
  };
}
