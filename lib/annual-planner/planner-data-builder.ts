import type { AgendaEvent } from "@/lib/agenda/types";
import type { CalendarSnapshot, ProgrammationPayload, SchoolWeek } from "@/lib/programming/types";
import type { ProgressionPayload, ProgressionRow } from "@/lib/progression/types";
import type {
  PlannerArtwork,
  PlannerBadge,
  PlannerBadgeKind,
  PlannerCompetenceStatus,
  PlannerPayload,
  PlannerSessionIndicator,
  PlannerStats,
  PlannerSubjectHours,
  PlannerTimelineMarker,
  PlannerVacationBlock,
  PlannerWeek,
} from "./types";
import { getBadgeAccent, getPeriodAccent, getSubjectAccent } from "./badge-colors";

type BuildPlannerInput = {
  calendar: CalendarSnapshot;
  programmation?: ProgrammationPayload | null;
  progression?: ProgressionPayload | null;
  agendaEvents?: AgendaEvent[];
  profile: PlannerPayload["profile"];
  timetableHours?: Record<string, number>;
};

const PERIOD_LABELS = ["Période 1", "Période 2", "Période 3", "Période 4", "Période 5"];

function findPeriodForWeek(calendar: CalendarSnapshot, week: SchoolWeek) {
  return calendar.periods.find((period) =>
    period.schoolWeeks.some((item) => item.weekNumberInYear === week.weekNumberInYear),
  );
}

function detectBadgeKind(text: string): PlannerBadgeKind | null {
  const lower = text.toLowerCase();
  if (lower.includes("sortie") || lower.includes("spectacle") || lower.includes("exposition")) {
    return "sortie";
  }
  if (lower.includes("évaluation") || lower.includes("evaluation") || lower.includes("contrôle")) {
    return "evaluation";
  }
  if (lower.includes("projet") || lower.includes("thème")) return "project";
  if (lower.includes("réunion") || lower.includes("conseil")) return "reunion";
  if (lower.includes("interven")) return "intervention";
  if (lower.includes("apc") || lower.includes("adaptation")) return "apc";
  if (lower.includes("œuvre") || lower.includes("oeuvre") || lower.includes("artiste")) return "oeuvre";
  if (lower.includes("séquence") || lower.includes("sequence")) return "sequence";
  return null;
}

function badgesFromCell(input: {
  subjectLabel: string;
  content: string;
  modules: string[];
  competences: string[];
  weekNumberInYear: number;
  periodNumber: number;
  weekIndexInPeriod: number;
}): PlannerBadge[] {
  const badges: PlannerBadge[] = [];
  const push = (kind: PlannerBadgeKind, label: string) => {
    badges.push({
      id: `${kind}-${input.weekNumberInYear}-${badges.length}`,
      kind,
      label,
      accent: getBadgeAccent(kind, input.subjectLabel),
      subjectKey: input.subjectLabel,
    });
  };

  for (const module of input.modules) {
    const kind = detectBadgeKind(module) ?? "sequence";
    push(kind, module);
  }

  const contentKind = detectBadgeKind(input.content);
  if (contentKind && input.content.trim()) {
    push(contentKind, input.content.trim().slice(0, 48));
  }

  if (input.competences.length > 0 && input.weekIndexInPeriod === 0) {
    push("subject", `${input.subjectLabel} · ${input.competences.length} comp.`);
  }

  return badges;
}

function sessionsForWeek(
  progression: ProgressionPayload | null | undefined,
  periodNumber: number,
  weekNumberInPeriod: number,
): PlannerSessionIndicator[] {
  if (!progression) return [];

  const sessions: PlannerSessionIndicator[] = [];
  for (const tab of progression.tabs) {
    for (const row of tab.rows) {
      if (row.periodNumber !== periodNumber || row.weekNumber !== weekNumberInPeriod) continue;
      sessions.push({
        id: row.id,
        label: row.seanceLabel || row.sequenceModule || "Séance",
        subjectLabel: tab.subjectLabel,
        competenceBo: row.competenceBo,
        progressionRowId: row.id,
        href: `/progression?row=${row.id}`,
      });
    }
  }
  return sessions;
}

function artworkFromTables(
  programmation: ProgrammationPayload | null | undefined,
  periodNumber: number,
): PlannerArtwork | undefined {
  if (!programmation) return undefined;

  for (const table of programmation.tables) {
    if (!table.subjectLabel.toLowerCase().includes("art")) continue;
    const period = table.periods.find((item) => item.periodNumber === periodNumber);
    if (!period) continue;

    const content = period.cell.content.trim();
    const modules = period.cell.modules.filter(Boolean);
    if (!content && modules.length === 0) continue;

    return {
      title: modules[0] || content.slice(0, 60) || "Œuvre à étudier",
      artist: period.cell.notions[0],
      movement: period.cell.guides[0],
      activity: period.cell.competences[0],
      href: `/programmation?period=${periodNumber}&subject=${encodeURIComponent(table.subjectLabel)}`,
    };
  }

  return undefined;
}

function agendaBadgesForWeek(events: AgendaEvent[], week: SchoolWeek): PlannerBadge[] {
  return events
    .filter((event) => {
      const date = event.startAt.slice(0, 10);
      return date >= week.startDate && date <= week.endDate;
    })
    .map((event) => {
      const kind = detectBadgeKind(`${event.title} ${event.eventType}`) ?? "evenement";
      return {
        id: `agenda-${event.id}`,
        kind,
        label: event.title,
        accent: getBadgeAccent(kind),
        href: `/agenda?event=${event.id}`,
        metadata: { eventType: event.eventType },
      };
    });
}

function buildVacationBlocks(calendar: CalendarSnapshot): PlannerVacationBlock[] {
  return calendar.vacations.map((vacation, index) => ({
    id: vacation.id,
    label: vacation.label,
    startDate: vacation.start,
    endDate: vacation.end,
    afterPeriodNumber: Math.min(index + 1, calendar.periods.length),
  }));
}

function buildTimeline(
  calendar: CalendarSnapshot,
  weeks: PlannerWeek[],
): PlannerTimelineMarker[] {
  const markers: PlannerTimelineMarker[] = [
    {
      id: "rentree",
      date: calendar.rentree,
      label: "Rentrée",
      kind: "rentree",
      accent: "sage",
    },
    {
      id: "fin-annee",
      date: calendar.finAnnee,
      label: "Fin d'année",
      kind: "fete",
      accent: "rose",
    },
  ];

  for (const vacation of calendar.vacations) {
    markers.push({
      id: `vac-${vacation.id}`,
      date: vacation.start,
      label: vacation.label,
      kind: "vacation",
      accent: "cream",
    });
  }

  for (const holiday of calendar.publicHolidays) {
    markers.push({
      id: `holiday-${holiday.date}`,
      date: holiday.date,
      label: holiday.label,
      kind: "holiday",
      accent: "lavender",
    });
  }

  for (const week of weeks) {
    for (const badge of week.badges) {
      if (badge.kind === "sortie" || badge.kind === "evaluation" || badge.kind === "project") {
        markers.push({
          id: `marker-${badge.id}`,
          date: week.startDate,
          label: badge.label,
          kind: badge.kind === "sortie" ? "sortie" : badge.kind === "evaluation" ? "evaluation" : "project",
          accent: badge.accent,
        });
      }
    }
  }

  return markers.sort((a, b) => a.date.localeCompare(b.date));
}

function buildStats(weeks: PlannerWeek[], progression?: ProgressionPayload | null): PlannerStats {
  const today = new Date().toISOString().slice(0, 10);
  const completed = weeks.filter((week) => week.endDate < today).length;
  const totalCompetences = progression?.validation.summary.totalCompetences ?? 0;
  const covered = progression?.validation.summary.coveredCompetences ?? 0;

  return {
    weeksCompleted: completed,
    weeksRemaining: Math.max(weeks.length - completed, 0),
    hoursCompleted: completed * 24,
    hoursTarget: weeks.length * 24,
    competencesValidated: covered,
    competencesTotal: totalCompetences,
    progressionsCompleted: progression?.validation.valid ? 1 : 0,
    sequencesInProgress: weeks.reduce((sum, week) => sum + week.sequenceSpans.length, 0),
    artworksStudied: weeks.filter((week) => week.artwork).length,
    sortiesCompleted: weeks.filter((week) => week.badges.some((badge) => badge.kind === "sortie" && week.isPast)).length,
    annualProgressPercent: weeks.length > 0 ? Math.round((completed / weeks.length) * 100) : 0,
  };
}

function buildCompetences(progression?: ProgressionPayload | null): PlannerCompetenceStatus[] {
  if (!progression) return [];

  const seen = new Map<string, PlannerCompetenceStatus>();

  for (const tab of progression.tabs) {
    for (const row of tab.rows) {
      const label = row.competenceBo.trim();
      if (!label) continue;
      if (!seen.has(label)) {
        seen.set(label, {
          id: label,
          label,
          status: "done",
          subjectLabel: tab.subjectLabel,
        });
      }
    }
  }

  return [...seen.values()];
}

function buildSubjectHours(
  programmation: ProgrammationPayload | null | undefined,
  timetableHours?: Record<string, number>,
): PlannerSubjectHours[] {
  const hours = new Map<string, number>();

  if (programmation) {
    for (const table of programmation.tables) {
      const weeks = table.periods.reduce((sum, period) => sum + period.weekCount, 0);
      hours.set(table.subjectLabel, (hours.get(table.subjectLabel) ?? 0) + weeks);
    }
  }

  const subjects = new Set([...hours.keys(), ...Object.keys(timetableHours ?? {})]);

  return [...subjects].map((subject) => {
    const planned = hours.get(subject) ?? 0;
    const target = timetableHours?.[subject] ?? planned;
    return {
      subject,
      planned,
      target,
      delta: planned - target,
      accent: getSubjectAccent(subject),
    };
  });
}

export function buildPlannerWeeks(input: BuildPlannerInput): PlannerWeek[] {
  const { calendar, programmation, progression, agendaEvents = [] } = input;
  const today = new Date().toISOString().slice(0, 10);

  return calendar.schoolWeeks.map((week) => {
    const period = findPeriodForWeek(calendar, week);
    const periodNumber = period?.periodNumber ?? 1;
    const weekIndexInPeriod = period?.schoolWeeks.findIndex(
      (item) => item.weekNumberInYear === week.weekNumberInYear,
    ) ?? 0;

    const badges: PlannerBadge[] = [];
    if (programmation) {
      for (const table of programmation.tables) {
        const periodColumn = table.periods.find((item) => item.periodNumber === periodNumber);
        if (!periodColumn) continue;

        const weekCount = periodColumn.weekCount || 1;
        const moduleIndex = weekIndexInPeriod % Math.max(periodColumn.cell.modules.length, 1);
        const modules =
          periodColumn.cell.modules.length > 0
            ? [periodColumn.cell.modules[moduleIndex % periodColumn.cell.modules.length]]
            : [];

        badges.push(
          ...badgesFromCell({
            subjectLabel: table.subjectLabel,
            content: weekIndexInPeriod === 0 ? periodColumn.cell.content : "",
            modules,
            competences: periodColumn.cell.competences,
            weekNumberInYear: week.weekNumberInYear,
            periodNumber,
            weekIndexInPeriod,
          }),
        );
      }
    }

    badges.push(...agendaBadgesForWeek(agendaEvents, week));

    const sessions = sessionsForWeek(progression, periodNumber, week.weekNumberInPeriod);
    const artwork = artworkFromTables(programmation, periodNumber);
    const loadScore = badges.length + sessions.length;

    return {
      id: `week-${week.weekNumberInYear}`,
      weekNumberInYear: week.weekNumberInYear,
      weekNumberInPeriod: week.weekNumberInPeriod,
      periodNumber,
      periodLabel: period?.label ?? PERIOD_LABELS[periodNumber - 1] ?? `Période ${periodNumber}`,
      periodAccent: getPeriodAccent(periodNumber),
      startDate: week.startDate,
      endDate: week.endDate,
      classDays: week.classDaysInWeek,
      isPartial: week.isPartial,
      publicHolidays: week.publicHolidays.map((item) => ({ date: item.date, label: item.label })),
      badges,
      sessions,
      artwork: weekIndexInPeriod === 0 ? artwork : undefined,
      sequenceSpans: [],
      loadScore,
      isPast: week.endDate < today,
      isCurrent: today >= week.startDate && today <= week.endDate,
    };
  });
}

export function buildPlannerPayload(input: BuildPlannerInput): Omit<PlannerPayload, "suggestions" | "alerts"> {
  const weeks = buildPlannerWeeks(input);

  return {
    calendar: input.calendar,
    weeks,
    vacations: buildVacationBlocks(input.calendar),
    timeline: buildTimeline(input.calendar, weeks),
    stats: buildStats(weeks, input.progression),
    competences: buildCompetences(input.progression),
    subjectHours: buildSubjectHours(input.programmation, input.timetableHours),
    programmationId: input.programmation?.programmation.id,
    progressionId: input.progression?.progression.id,
    profile: input.profile,
  };
}

export function collectAllProgressionRows(progression?: ProgressionPayload | null): ProgressionRow[] {
  if (!progression) return [];
  return progression.tabs.flatMap((tab) => tab.rows);
}
