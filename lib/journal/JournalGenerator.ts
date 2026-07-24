import { loadTeacherProfileBundle } from "@/lib/profile";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import { adjustmentEngine } from "./AdjustmentEngine";
import { buildJournalPreviewForDate } from "./journal-preview";
import { enrichJournalPayload } from "./journal-view-flags";
import { planJournalDayFromImports } from "./journal-restitution";
import { formatDateLabel, getWeekDates, addDays } from "./date-utils";
import {
  findJournalByDate,
  loadJournalPayload,
  saveAdjustments,
  saveJournalPayload,
} from "./journal-service";
import { resolveJournalTimetable } from "./JournalTimetableResolver";
import { computeProgressPercents } from "./ProgressCalculator";
import { scheduleEngine } from "./ScheduleEngine";
import { teachingDashboard } from "./TeachingDashboard";
import { journalValidator, computeDashboard } from "./JournalValidator";
import type { JournalDaySummary, JournalPayload, JournalRangePayload } from "./types";

export class JournalGenerator {
  async generateForDate(input: {
    date: string;
    regenerate?: boolean;
    proposeAdjustments?: boolean;
    persist?: boolean;
  }): Promise<JournalPayload> {
    if (!input.persist) {
      return buildJournalPreviewForDate(input.date);
    }

    const profileBundle = await loadTeacherProfileBundle();
    if (!profileBundle) {
      throw new Error("Profil enseignant requis pour générer le cahier journal.");
    }

    const existing = await findJournalByDate(input.date, profileBundle.profile.id);

    if (!input.regenerate && existing) {
      const cached = await loadJournalPayload(existing.id);
      if (cached) return this.enrichPayload(cached, profileBundle.profile.schoolYear);
    }

    const profile = profileBundle.profile;
    const timetableResolved = await resolveJournalTimetable(profileBundle);
    if (!timetableResolved.hasActiveSchedule) {
      return buildJournalPreviewForDate(input.date);
    }

    const calendar = schoolWeeksCalculator.calculate(
      profile.schoolYear,
      profile.zoneScolaire,
      { includeBridgeDays: true },
    );

    const resolvedDay = scheduleEngine.resolveDay(
      calendar,
      timetableResolved,
      input.date,
      profile.workingDays,
    );
    const isTeacherOff = scheduleEngine.isNonWorkingDay(calendar, input.date, profile.workingDays);

    const journalId = input.regenerate && existing ? existing.id : undefined;

    const { entries } = await planJournalDayFromImports({
      journalId: journalId ?? "draft",
      date: input.date,
      periodNumber: resolvedDay.periodNumber,
      weekNumber: resolvedDay.weekNumber,
      profile: profileBundle,
      resolvedDay,
    });

    const annualProject = profileBundle.projects.find((project) => project.projectType === "annuel");
    const periodProject = profileBundle.projects.find((project) => project.projectType === "periode");

    const progress = await computeProgressPercents({
      schoolYear: profile.schoolYear,
      periodNumber: resolvedDay.periodNumber,
    });

    const dashboard = {
      ...computeDashboard(entries.map((entry) => ({ ...entry, id: "", observation: null }))),
      ...progress,
    };

    const absents: string[] = [];
    if (profile.ulis) absents.push("Groupe ULIS");
    if (profile.segpa) absents.push("SEGPA");

    const payload = await saveJournalPayload({
      journal: {
        id: journalId,
        teacherProfileId: profile.id,
        schoolYear: profile.schoolYear,
        journalDate: input.date,
        className: profile.personalization.className || `${profile.levels.join(", ")}`,
        effectif: profile.studentCount,
        presents: profile.studentCount,
        absents,
        dailyProject: periodProject?.title || annualProject?.title || "",
        mainObjectives: entries
          .map((entry) => entry.objectif)
          .filter(Boolean)
          .slice(0, 5),
        importantInfo: resolvedDay.isHoliday
          ? "Jour férié ou pont — vérifier le calendrier."
          : resolvedDay.isVacation
            ? "Vacances scolaires."
            : isTeacherOff
              ? "Jour non travaillé selon votre profil pédagogique."
              : "",
        remarks: profile.rep ? "Classe REP — adapter les temps de séance si besoin." : "",
        periodNumber: resolvedDay.periodNumber,
        weekNumber: resolvedDay.weekNumber,
        status:
          resolvedDay.isHoliday || resolvedDay.isVacation || isTeacherOff ? "inactive" : "ready",
        dashboard,
        metadata: {
          dateLabel: formatDateLabel(input.date),
          dayName: resolvedDay.dayName,
          classType: profile.classType,
          ulis: profile.ulis,
          segpa: profile.segpa,
          rep: profile.rep,
          restitutionMode: true,
          calendarSync: {
            enabled: false,
            provider: null,
            lastSyncAt: null,
            metadata: {},
          },
        },
      },
      entries,
      preserveObservations: Boolean(journalId),
    });

    const enriched = await this.enrichPayload(payload, profile.schoolYear);
    journalValidator.assertReady(enriched);

    if (input.proposeAdjustments) {
      const proposals = await adjustmentEngine.proposeAdjustments({
        journal: enriched.journal,
        entries: enriched.entries,
      });
      await saveAdjustments(enriched.journal.id, proposals);
      enriched.adjustments = proposals.map((item, index) => ({
        ...item,
        id: `pending-${index}`,
        journalId: enriched.journal.id,
      }));
    }

    return enriched;
  }

  async generateForWeek(date: string): Promise<JournalRangePayload> {
    const weekDates = getWeekDates(date);
    const days: JournalDaySummary[] = [];

    for (const weekDate of weekDates) {
      try {
        const payload = await this.generateForDate({ date: weekDate });
        days.push(this.toSummary(payload));
      } catch {
        days.push({
          date: weekDate,
          journalId: null,
          status: "unavailable",
          entryCount: 0,
          completedSessions: 0,
          plannedMinutes: 0,
          isHoliday: false,
        });
      }
    }

    return {
      startDate: weekDates[0] ?? date,
      endDate: weekDates[weekDates.length - 1] ?? date,
      days,
    };
  }

  async generateForPeriod(date: string): Promise<JournalRangePayload> {
    const profileBundle = await loadTeacherProfileBundle();
    if (!profileBundle) throw new Error("Profil requis.");

    const calendar = schoolWeeksCalculator.calculate(
      profileBundle.profile.schoolYear,
      profileBundle.profile.zoneScolaire,
      { includeBridgeDays: true },
    );

    const resolved = scheduleEngine.resolveDay(
      calendar,
      await resolveJournalTimetable(profileBundle),
      date,
      profileBundle.profile.workingDays,
    );

    const period = calendar.periods.find((item) => item.periodNumber === resolved.periodNumber);
    if (!period) {
      return this.generateForWeek(date);
    }

    const days: JournalDaySummary[] = [];
    let cursor = period.startDate;

    while (cursor <= period.endDate) {
      if (!scheduleEngine.isNonWorkingDay(calendar, cursor, profileBundle.profile.workingDays)) {
        try {
          const payload = await this.generateForDate({ date: cursor });
          days.push(this.toSummary(payload));
        } catch {
          days.push({
            date: cursor,
            journalId: null,
            status: "unavailable",
            entryCount: 0,
            completedSessions: 0,
            plannedMinutes: 0,
            isHoliday: false,
          });
        }
      }
      cursor = addDays(cursor, 1);
    }

    return {
      startDate: period.startDate,
      endDate: period.endDate,
      days,
    };
  }

  private toSummary(payload: JournalPayload): JournalDaySummary {
    return {
      date: payload.journal.journalDate,
      journalId: payload.journal.id,
      status: payload.journal.status,
      entryCount: payload.entries.length,
      completedSessions: payload.journal.dashboard.completedSessions,
      plannedMinutes: payload.journal.dashboard.plannedMinutes,
      isHoliday: payload.journal.status === "inactive",
    };
  }

  private async enrichPayload(payload: JournalPayload, schoolYear: string): Promise<JournalPayload> {
    const profileBundle = await loadTeacherProfileBundle();
    const calendar = profileBundle
      ? schoolWeeksCalculator.calculate(
          schoolYear,
          profileBundle.profile.zoneScolaire,
          { includeBridgeDays: true },
        )
      : null;

    payload.calendar = calendar;
    payload.journal.dashboard = teachingDashboard.build(payload.journal, payload.entries);

    const progress = await computeProgressPercents({
      schoolYear,
      periodNumber: payload.journal.periodNumber,
    });

    payload.journal.dashboard = {
      ...payload.journal.dashboard,
      ...progress,
    };

    return enrichJournalPayload(payload);
  }
}

export const journalGenerator = new JournalGenerator();
