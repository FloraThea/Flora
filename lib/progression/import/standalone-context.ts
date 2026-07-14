import type { CalendarSnapshot } from "@/lib/programming/types";
import type { ProgressionContext } from "../types";
import type { ProgressionImportSession } from "./types";

export function emptyCalendarSnapshot(schoolYear = "2026-2027"): CalendarSnapshot {
  return {
    schoolYear,
    academicZone: "A",
    rentree: "",
    finAnnee: "",
    vacations: [],
    periods: [],
    weeks: [],
    totalWeeks: 36,
    workingDays: ["Lundi", "Mardi", "Jeudi", "Vendredi"],
    teacherWorkingDays: ["Lundi", "Mardi", "Jeudi", "Vendredi"],
    zoneLabel: "Zone A",
  } as unknown as CalendarSnapshot;
}

export function buildStandaloneProgressionContext(input: {
  methode: string;
  schoolYear?: string;
}): ProgressionContext {
  return {
    programmation: {
      programmation: {
        id: "",
        title: "",
        school_year: input.schoolYear ?? "2026-2027",
        academic_zone: "A",
        levels: [],
        matiere: "",
        methode: input.methode,
        projet_annuel: "",
        timetable: { slots: [], weeklyHoursBySubject: {} },
        calendar_snapshot: emptyCalendarSnapshot(input.schoolYear),
        validation: { valid: true, issues: [], summary: {} as never },
        status: "validated",
        metadata: {},
        created_at: "",
        updated_at: "",
      } as ProgressionContext["programmation"]["programmation"],
      tables: [],
      validation: { valid: true, issues: [], summary: {} as never },
    },
    referentiel: [],
    resources: [],
    calendar: emptyCalendarSnapshot(input.schoolYear),
    timetable: { slots: [], weeklyHoursBySubject: {} },
    methode: input.methode,
  };
}

export function sessionLinkMode(session: Pick<ProgressionImportSession, "programmationId">): "linked" | "independent" {
  return session.programmationId ? "linked" : "independent";
}
