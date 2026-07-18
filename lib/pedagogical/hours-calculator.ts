import { floraDb } from "@/lib/supabase/get-db";
import { loadActiveTimetableInput } from "@/lib/timetable/active-timetable";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import type { HoursBalance, PedagogicalStats } from "./types";

export async function recalculateHourVolumes(): Promise<HoursBalance[]> {
  const scope = await requireTeacherScope();
  const activeTimetable = await loadActiveTimetableInput(scope.profileId);
  const plannedBySubject = new Map<string, number>(Object.entries(activeTimetable.weeklyHoursBySubject));
  const timetableHours = activeTimetable.weeklyHoursBySubject;

  const subjects = new Set([...Object.keys(timetableHours), ...plannedBySubject.keys()]);

  return [...subjects].map((subject) => {
    const plannedHours = Math.round((plannedBySubject.get(subject) ?? 0) * 10) / 10;
    const targetHours = Number(timetableHours[subject] ?? plannedHours);
    const delta = Math.round((plannedHours - targetHours) * 10) / 10;
    const remainingHours = Math.max(0, Math.round((targetHours - plannedHours) * 10) / 10);

    let alert: string | undefined;
    if (delta < -1) alert = `${subject} : risque de ne pas atteindre le volume horaire.`;
    if (delta > 1) alert = `${subject} : dépasse les horaires officiels.`;

    return { subject, plannedHours, targetHours, remainingHours, delta, alert };
  });
}

export async function recalculatePedagogicalStats(
  conflictCount = 0,
): Promise<PedagogicalStats> {
  const scope = await requireTeacherScope();
  const hoursBalance = await recalculateHourVolumes();

  const { count: totalCompetences } = await (await floraDb())
    .from("referentiels")
    .select("id", { count: "exact", head: true });

  const { data: coveredRows } = await (await floraDb())
    .from("progression_rows")
    .select("referentiel_ids, progression_id")
    .not("referentiel_ids", "eq", "[]");

  const { data: ownedProgressions } = await (await floraDb())
    .from("progressions")
    .select("id")
    .eq("teacher_profile_id", scope.profileId);

  const ownedIds = new Set((ownedProgressions ?? []).map((row) => String(row.id)));

  const coveredIds = new Set<string>();
  for (const row of coveredRows ?? []) {
    if (!ownedIds.has(String(row.progression_id))) continue;
    for (const id of (row.referentiel_ids as string[]) ?? []) {
      coveredIds.add(id);
    }
  }

  const calendarWeeks = 36;
  const today = new Date().toISOString().slice(0, 10);

  const { data: pastSeances } = await (await floraDb())
    .from("seances")
    .select("id")
    .eq("teacher_profile_id", scope.profileId)
    .lte("session_date", today);

  const completedRatio = Math.min(1, (pastSeances?.length ?? 0) / Math.max(calendarWeeks * 4, 1));

  return {
    annualProgressPercent: Math.round(completedRatio * 100),
    competencesCovered: coveredIds.size,
    competencesTotal: totalCompetences ?? 0,
    hoursBalance,
    conflictCount,
  };
}
