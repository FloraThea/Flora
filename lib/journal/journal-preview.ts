import { loadTeacherProfileBundle } from "@/lib/profile";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import { formatDateLabel } from "./date-utils";
import { dailyPlanner } from "./DailyPlanner";
import { findJournalByDate, loadJournalPayload, saveJournalPayload } from "./journal-service";
import { resolveJournalScheduleSlots } from "./journal-timetable";
import { scheduleEngine } from "./ScheduleEngine";
import { computeDashboard } from "./JournalValidator";
import { enrichJournalPayload } from "./journal-view-flags";
import type { JournalEntry, JournalPayload } from "./types";

function emptyDashboard() {
  return {
    plannedMinutes: 0,
    actualMinutes: 0,
    completedSessions: 0,
    remainingSessions: 0,
    completedRituals: 0,
    workedCompetences: [] as string[],
    remainingCompetences: [] as string[],
    periodProgressPercent: 0,
    annualProgressPercent: 0,
  };
}

function draftEntryId(index: number): string {
  return `preview-entry-${index}`;
}

function mapPreviewEntries(
  entries: Omit<JournalEntry, "id" | "observation">[],
): JournalEntry[] {
  return entries.map((entry, index) => ({
    ...entry,
    id: draftEntryId(index),
    observation: null,
    metadata: {
      ...entry.metadata,
      isPersisted: false,
      fillState: entry.metadata.fillState ?? "empty",
    },
  }));
}

export type JournalPreviewResult = JournalPayload & {
  preview: boolean;
  hasTimetable: boolean;
  noClassDay: boolean;
  specialDayMessage?: string;
};

export async function buildJournalPreviewForDate(date: string): Promise<JournalPreviewResult> {
  const profileBundle = await loadTeacherProfileBundle();
  if (!profileBundle) {
    throw new Error("Profil enseignant requis.");
  }

  const profileId = profileBundle.profile.id;
  const existing = await findJournalByDate(date, profileId);
  if (existing) {
    const persisted = await loadJournalPayload(existing.id);
    if (persisted) {
      return {
        ...persisted,
        preview: false,
        hasTimetable: true,
        noClassDay: persisted.journal.status === "inactive",
      };
    }
  }

  const timetable = await resolveJournalScheduleSlots(profileBundle);
  const calendar = schoolWeeksCalculator.calculate(
    profileBundle.profile.schoolYear,
    profileBundle.profile.zoneScolaire,
    { includeBridgeDays: true },
  );

  const resolvedDay = scheduleEngine.resolveDay(
    calendar,
    { slots: timetable.slots, weeklyHoursBySubject: {} },
    date,
    profileBundle.profile.workingDays,
  );

  const isTeacherOff = scheduleEngine.isNonWorkingDay(
    calendar,
    date,
    profileBundle.profile.workingDays,
  );

  if (!timetable.hasActiveSchedule) {
    return {
      journal: {
        id: "preview",
        teacherProfileId: profileId,
        schoolYear: profileBundle.profile.schoolYear,
        journalDate: date,
        className: profileBundle.profile.personalization.className || "",
        effectif: profileBundle.profile.studentCount,
        presents: profileBundle.profile.studentCount,
        absents: [],
        dailyProject: "",
        mainObjectives: [],
        importantInfo: "",
        remarks: "",
        periodNumber: resolvedDay.periodNumber,
        weekNumber: resolvedDay.weekNumber,
        status: "empty",
        dashboard: emptyDashboard(),
        metadata: {
          dateLabel: formatDateLabel(date),
          dayName: resolvedDay.dayName,
          isPreview: true,
          missingTimetable: true,
        },
        created_at: "",
        updated_at: "",
      },
      entries: [],
      adjustments: [],
      calendar,
      preview: true,
      hasTimetable: false,
      noClassDay: false,
      specialDayMessage:
        "Aucun emploi du temps n'est encore disponible. Créez ou importez votre emploi du temps pour générer les plages horaires.",
    };
  }

  if (resolvedDay.isHoliday || resolvedDay.isVacation) {
    return {
      journal: {
        id: "preview",
        teacherProfileId: profileId,
        schoolYear: profileBundle.profile.schoolYear,
        journalDate: date,
        className: profileBundle.profile.personalization.className || "",
        effectif: profileBundle.profile.studentCount,
        presents: profileBundle.profile.studentCount,
        absents: [],
        dailyProject: "",
        mainObjectives: [],
        importantInfo: resolvedDay.isVacation ? "Vacances scolaires." : "Jour férié ou pont.",
        remarks: "",
        periodNumber: resolvedDay.periodNumber,
        weekNumber: resolvedDay.weekNumber,
        status: "inactive",
        dashboard: emptyDashboard(),
        metadata: {
          dateLabel: formatDateLabel(date),
          dayName: resolvedDay.dayName,
          isPreview: true,
          isHoliday: resolvedDay.isHoliday,
          isVacation: resolvedDay.isVacation,
        },
        created_at: "",
        updated_at: "",
      },
      entries: [],
      adjustments: [],
      calendar,
      preview: true,
      hasTimetable: true,
      noClassDay: true,
      specialDayMessage: resolvedDay.isVacation
        ? "Vacances scolaires — aucune classe prévue."
        : "Jour férié ou pont — aucune classe prévue.",
    };
  }

  if (isTeacherOff || resolvedDay.slots.length === 0) {
    return {
      journal: {
        id: "preview",
        teacherProfileId: profileId,
        schoolYear: profileBundle.profile.schoolYear,
        journalDate: date,
        className: profileBundle.profile.personalization.className || "",
        effectif: profileBundle.profile.studentCount,
        presents: profileBundle.profile.studentCount,
        absents: [],
        dailyProject: "",
        mainObjectives: [],
        importantInfo: "Jour non travaillé selon votre profil pédagogique.",
        remarks: "",
        periodNumber: resolvedDay.periodNumber,
        weekNumber: resolvedDay.weekNumber,
        status: "inactive",
        dashboard: emptyDashboard(),
        metadata: {
          dateLabel: formatDateLabel(date),
          dayName: resolvedDay.dayName,
          isPreview: true,
        },
        created_at: "",
        updated_at: "",
      },
      entries: [],
      adjustments: [],
      calendar,
      preview: true,
      hasTimetable: true,
      noClassDay: true,
      specialDayMessage: "Aucune classe prévue ce jour.",
    };
  }

  const draftEntries = dailyPlanner.planDay({
    journalId: "preview",
    resolvedDay,
    profile: profileBundle,
    seances: [],
    resourcesByMatiere: {},
    linkSeances: false,
  });

  const entries = mapPreviewEntries(draftEntries);
  const dashboard = computeDashboard(entries);

  return {
    journal: {
      id: "preview",
      teacherProfileId: profileId,
      schoolYear: profileBundle.profile.schoolYear,
      journalDate: date,
      className: profileBundle.profile.personalization.className || "",
      effectif: profileBundle.profile.studentCount,
      presents: profileBundle.profile.studentCount,
      absents: [],
      dailyProject: "",
      mainObjectives: [],
      importantInfo: "",
      remarks: "",
      periodNumber: resolvedDay.periodNumber,
      weekNumber: resolvedDay.weekNumber,
      status: "draft",
      dashboard,
      metadata: {
        dateLabel: formatDateLabel(date),
        dayName: resolvedDay.dayName,
        isPreview: true,
        scheduleId: timetable.scheduleId,
      },
      created_at: "",
      updated_at: "",
    },
    entries,
    adjustments: [],
    calendar,
    preview: true,
    hasTimetable: true,
    noClassDay: false,
  };
}

/** Crée une journée manuelle sans emploi du temps (entrées vides, saisie libre). */
export async function createManualJournalDay(date: string) {
  const profileBundle = await loadTeacherProfileBundle();
  if (!profileBundle) {
    throw new Error("Profil enseignant requis.");
  }

  const profileId = profileBundle.profile.id;
  const existing = await findJournalByDate(date, profileId);
  if (existing) {
    const loaded = await loadJournalPayload(existing.id);
    if (loaded) {
      return enrichJournalPayload({
        ...loaded,
        preview: false,
        hasTimetable: false,
      });
    }
  }

  const calendar = schoolWeeksCalculator.calculate(
    profileBundle.profile.schoolYear,
    profileBundle.profile.zoneScolaire,
    { includeBridgeDays: true },
  );

  const resolvedDay = scheduleEngine.resolveDay(
    calendar,
    { slots: [], weeklyHoursBySubject: {} },
    date,
    profileBundle.profile.workingDays,
  );

  const payload = await saveJournalPayload({
    journal: {
      teacherProfileId: profileId,
      schoolYear: profileBundle.profile.schoolYear,
      journalDate: date,
      className: profileBundle.profile.personalization.className || "",
      effectif: profileBundle.profile.studentCount,
      presents: profileBundle.profile.studentCount,
      absents: [],
      dailyProject: "",
      mainObjectives: [],
      importantInfo: "",
      remarks: "",
      periodNumber: resolvedDay.periodNumber,
      weekNumber: resolvedDay.weekNumber,
      status: "draft",
      dashboard: emptyDashboard(),
      metadata: {
        dateLabel: formatDateLabel(date),
        dayName: resolvedDay.dayName,
        manualDay: true,
      },
    },
    entries: [],
  });

  return enrichJournalPayload({ ...payload, preview: false });
}
