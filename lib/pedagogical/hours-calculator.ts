import { supabase } from "@/lib/supabase";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import type { HoursBalance, PedagogicalStats } from "./types";

export async function recalculateHourVolumes(): Promise<HoursBalance[]> {
  const bundle = await loadTeacherProfileBundle();
  const timetableHours = bundle?.profile.timetables?.[0]?.timetable?.weeklyHoursBySubject ?? {};

  const { data: slots } = await supabase.from("timetable_slots").select("subject, start, end");

  const plannedBySubject = new Map<string, number>();

  for (const slot of slots ?? []) {
    const subject = String(slot.subject ?? "Autre");
    const start = String(slot.start ?? "08:00");
    const end = String(slot.end ?? "09:00");
    const minutes = timeToMinutes(end) - timeToMinutes(start);
    plannedBySubject.set(subject, (plannedBySubject.get(subject) ?? 0) + minutes / 60);
  }

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
  const hoursBalance = await recalculateHourVolumes();

  const { count: totalCompetences } = await supabase
    .from("referentiels")
    .select("id", { count: "exact", head: true });

  const { data: coveredRows } = await supabase
    .from("progression_rows")
    .select("referentiel_ids")
    .not("referentiel_ids", "eq", "[]");

  const coveredIds = new Set<string>();
  for (const row of coveredRows ?? []) {
    for (const id of (row.referentiel_ids as string[]) ?? []) {
      coveredIds.add(id);
    }
  }

  const bundle = await loadTeacherProfileBundle();
  const calendarWeeks = 36;
  const today = new Date().toISOString().slice(0, 10);

  const { data: pastSeances } = await supabase
    .from("seances")
    .select("id")
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

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}
