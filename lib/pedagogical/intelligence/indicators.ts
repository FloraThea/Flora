import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { onlyActive } from "@/lib/trash/active-query";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import type { PedagogicalStats } from "../types";
import type { ExtendedIndicators } from "./types";

export async function buildExtendedIndicators(
  base: PedagogicalStats,
  conflictCount: number,
  totalWeeksInYear = 36,
): Promise<ExtendedIndicators> {
  const scope = await requireTeacherScope();

  const [programmations, progressions, sequences, seances] = await Promise.all([
    onlyActive(
      (await floraDb())
        .from("programmations")
        .select("id, matiere")
        .eq("teacher_profile_id", scope.profileId),
    ),
    onlyActive(
      (await floraDb())
        .from("progressions")
        .select("id, matiere")
        .eq("teacher_profile_id", scope.profileId),
    ),
    onlyActive(
      (await floraDb())
        .from("sequences")
        .select("id, matiere")
        .eq("teacher_profile_id", scope.profileId),
    ),
    onlyActive(
      (await floraDb())
        .from("seances")
        .select("id, matiere, period_number, duree_minutes")
        .eq("teacher_profile_id", scope.profileId),
    ),
  ]);

  const byMatiereMap = new Map<string, { seances: number; progressions: number }>();
  for (const row of progressions.data ?? []) {
    const matiere = String(row.matiere ?? "Sans matière");
    const bucket = byMatiereMap.get(matiere) ?? { seances: 0, progressions: 0 };
    bucket.progressions += 1;
    byMatiereMap.set(matiere, bucket);
  }
  for (const row of seances.data ?? []) {
    const matiere = String(row.matiere ?? "Sans matière");
    const bucket = byMatiereMap.get(matiere) ?? { seances: 0, progressions: 0 };
    bucket.seances += 1;
    byMatiereMap.set(matiere, bucket);
  }

  const byPeriodMap = new Map<number, { seanceCount: number; weekCount: number }>();
  for (const row of seances.data ?? []) {
    const period = Number(row.period_number ?? 0);
    const bucket = byPeriodMap.get(period) ?? { seanceCount: 0, weekCount: 0 };
    bucket.seanceCount += 1;
    byPeriodMap.set(period, bucket);
  }

  const plannedMinutes = (seances.data ?? []).reduce(
    (sum, row) => sum + Number(row.duree_minutes ?? 45),
    0,
  );
  const plannedHoursTotal = Math.round((plannedMinutes / 60) * 10) / 10;
  const targetHoursTotal = base.hoursBalance.reduce((sum, row) => sum + row.targetHours, 0);
  const remainingHoursTotal = Math.max(0, Math.round((targetHoursTotal - plannedHoursTotal) * 10) / 10);

  const { data: progressionRows } = await (await floraDb())
    .from("progression_rows")
    .select("period_number, week_number, progression_id")
    .limit(3000);

  const ownedProgressionIdSet = new Set((progressions.data ?? []).map((row) => String(row.id)));
  const plannedWeekKeys = new Set<string>();
  for (const row of progressionRows ?? []) {
    if (!ownedProgressionIdSet.has(String(row.progression_id))) continue;
    plannedWeekKeys.add(`${row.period_number}-${row.week_number}`);
  }

  const plannedProgressPercent =
    totalWeeksInYear === 0
      ? 0
      : Math.round((plannedWeekKeys.size / totalWeeksInYear) * 100);

  return {
    ...base,
    conflictCount,
    seanceCount: seances.data?.length ?? 0,
    sequenceCount: sequences.data?.length ?? 0,
    progressionCount: progressions.data?.length ?? 0,
    programmationCount: programmations.data?.length ?? 0,
    plannedHoursTotal,
    remainingHoursTotal,
    plannedProgressPercent,
    byMatiere: [...byMatiereMap.entries()]
      .map(([matiere, counts]) => ({ matiere, ...counts }))
      .sort((a, b) => a.matiere.localeCompare(b.matiere, "fr")),
    byPeriod: [...byPeriodMap.entries()]
      .map(([periodNumber, counts]) => ({ periodNumber, ...counts, weekCount: 0 }))
      .sort((a, b) => a.periodNumber - b.periodNumber),
  };
}
