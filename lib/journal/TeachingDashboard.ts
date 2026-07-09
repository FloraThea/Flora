import type { JournalDashboard, JournalEntry, StoredJournal } from "./types";

export class TeachingDashboard {
  build(journal: StoredJournal, entries: JournalEntry[]): JournalDashboard {
    const dashboard = journal.dashboard;
    const lessonEntries = entries.filter((entry) => entry.entryType === "slot");

    return {
      ...dashboard,
      plannedMinutes: entries.reduce((sum, entry) => sum + entry.dureeMinutes, 0),
      actualMinutes: entries.reduce(
        (sum, entry) => sum + (entry.observation?.actualMinutes ?? 0),
        0,
      ),
      completedSessions: lessonEntries.filter(
        (entry) => entry.observation?.status === "realisee",
      ).length,
      remainingSessions: lessonEntries.filter(
        (entry) => !entry.observation || entry.observation.status !== "realisee",
      ).length,
      completedRituals: entries.filter(
        (entry) => entry.entryType === "ritual" && entry.observation?.status === "realisee",
      ).length,
      workedCompetences: [
        ...new Set(
          lessonEntries.map((entry) => entry.competence).filter(Boolean),
        ),
      ],
      remainingCompetences: [
        ...new Set(
          lessonEntries
            .filter((entry) => entry.observation?.status !== "realisee")
            .map((entry) => entry.competence)
            .filter(Boolean),
        ),
      ],
      periodProgressPercent: dashboard.periodProgressPercent,
      annualProgressPercent: dashboard.annualProgressPercent,
    };
  }
}

export const teachingDashboard = new TeachingDashboard();
