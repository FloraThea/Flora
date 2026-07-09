import { FloraAppShell } from "@/components/ui/FloraAppShell";
import { loadAnnualPlannerPayload } from "@/lib/annual-planner/planner-service";
import type { PlannerPayload } from "@/lib/annual-planner/types";
import { AnnualPlanner } from "./components/AnnualPlanner";

export default async function PlanificateurAnnuelPage() {
  let payload: PlannerPayload;

  try {
    payload = await loadAnnualPlannerPayload();
  } catch {
    payload = {
      calendar: {
        schoolYear: "2025-2026",
        academicZone: "A",
        rentree: "2025-09-01",
        finAnnee: "2026-07-04",
        vacations: [],
        publicHolidays: [],
        bridgeDays: [],
        periods: [],
        totalClassWeeks: 36,
        totalWorkingWeeks: 36,
        totalEffectiveWorkingDays: 180,
        totalPartialWeeks: 0,
        schoolWeeks: [],
        teacherWorkingDays: [],
      },
      weeks: [],
      vacations: [],
      timeline: [],
      stats: {
        weeksCompleted: 0,
        weeksRemaining: 36,
        hoursCompleted: 0,
        hoursTarget: 864,
        competencesValidated: 0,
        competencesTotal: 0,
        progressionsCompleted: 0,
        sequencesInProgress: 0,
        artworksStudied: 0,
        sortiesCompleted: 0,
        annualProgressPercent: 0,
      },
      competences: [],
      subjectHours: [],
      suggestions: [],
      alerts: [],
      profile: { prenom: "", levels: [], schoolYear: "2025-2026", zone: "A" },
    };
  }

  return (
    <FloraAppShell>
      <AnnualPlanner initialPayload={payload} />
    </FloraAppShell>
  );
}
