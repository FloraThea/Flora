import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { onlyActive } from "@/lib/trash/active-query";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import type { CalendarSnapshot, SchoolWeek } from "@/lib/programming/types";
import type { WeeklyPilotageWeek } from "./types";

function findPeriodForWeek(calendar: CalendarSnapshot, week: SchoolWeek) {
  return calendar.periods.find((period) =>
    period.schoolWeeks.some((item) => item.weekNumberInYear === week.weekNumberInYear),
  );
}

export async function buildWeeklyPilotage(): Promise<WeeklyPilotageWeek[]> {
  const scope = await requireTeacherScope();
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) return [];

  const calendar = schoolWeeksCalculator.calculate(
    bundle.profile.schoolYear,
    bundle.profile.zoneScolaire,
    { teacherWorkingDays: bundle.profile.workingDays },
  );

  const { data: progressionRows } = await (await floraDb())
    .from("progression_rows")
    .select("period_number, week_number, competence_bo, sequence_module, progression_id, matiere")
    .limit(5000);

  const { data: ownedProgressions } = await onlyActive(
    (await floraDb()).from("progressions").select("id, matiere").eq("teacher_profile_id", scope.profileId),
  );
  const matiereByProgression = new Map(
    (ownedProgressions ?? []).map((row) => [String(row.id), String(row.matiere ?? "")]),
  );
  const ownedIds = new Set([...matiereByProgression.keys()]);

  const { data: seances } = await onlyActive(
    (await floraDb())
      .from("seances")
      .select("period_number, week_number, matiere, title, evaluation")
      .eq("teacher_profile_id", scope.profileId),
  );

  const weekMap = new Map<string, WeeklyPilotageWeek>();

  for (const week of calendar.schoolWeeks) {
    if (week.teacherWorkingDaysInWeek <= 0) continue;
    const period = findPeriodForWeek(calendar, week);
    const periodNumber = period?.periodNumber ?? 1;
    const key = `${periodNumber}-${week.weekNumberInPeriod}`;
    weekMap.set(key, {
      weekNumberInYear: week.weekNumberInYear,
      periodNumber,
      startDate: week.startDate,
      endDate: week.endDate,
      subjects: [],
      competences: [],
      seanceCount: 0,
      evaluationCount: 0,
      projectCount: 0,
      outingCount: 0,
    });
  }

  for (const row of progressionRows ?? []) {
    if (!ownedIds.has(String(row.progression_id))) continue;
    const key = `${row.period_number}-${row.week_number}`;
    const bucket = weekMap.get(key);
    if (!bucket) continue;
    const matiere = String(row.matiere ?? matiereByProgression.get(String(row.progression_id)) ?? "");
    if (matiere && !bucket.subjects.includes(matiere)) bucket.subjects.push(matiere);
    const competence = String(row.competence_bo ?? "").trim();
    if (competence && !bucket.competences.includes(competence)) bucket.competences.push(competence);
    const module = String(row.sequence_module ?? "").toLowerCase();
    if (module.includes("projet")) bucket.projectCount += 1;
    if (module.includes("sortie")) bucket.outingCount += 1;
  }

  for (const seance of seances ?? []) {
    const key = `${seance.period_number}-${seance.week_number}`;
    const bucket = weekMap.get(key);
    if (!bucket) continue;
    bucket.seanceCount += 1;
    const matiere = String(seance.matiere ?? "");
    if (matiere && !bucket.subjects.includes(matiere)) bucket.subjects.push(matiere);
    const evaluation = seance.evaluation;
    if (
      evaluation &&
      typeof evaluation === "object" &&
      Object.keys(evaluation as Record<string, unknown>).length > 0
    ) {
      bucket.evaluationCount += 1;
    }
    const title = String(seance.title ?? "").toLowerCase();
    if (title.includes("éval") || title.includes("eval")) bucket.evaluationCount += 1;
  }

  return [...weekMap.values()].sort((a, b) => a.weekNumberInYear - b.weekNumberInYear);
}
