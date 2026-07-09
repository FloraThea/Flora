import { supabase } from "@/lib/supabase";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import { loadProgrammation, listValidatedProgrammations } from "@/lib/programming/programmation-service";
import { loadProgression } from "@/lib/progression/progression-service";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { analyzePlanner } from "./intelligence-engine";
import { buildPlannerPayload } from "./planner-data-builder";
import type { PlannerPayload } from "./types";

export async function loadAnnualPlannerPayload(): Promise<PlannerPayload> {
  const bundle = await loadTeacherProfileBundle();
  const schoolYear = bundle?.profile.schoolYear ?? "2025-2026";
  const zone = bundle?.profile.zoneScolaire ?? "A";

  const calendar = schoolWeeksCalculator.calculate(schoolYear, zone, {
    includeBridgeDays: true,
    teacherWorkingDays: bundle?.profile.workingDays,
  });

  const programmations = await listValidatedProgrammations();
  const matchingProgrammation = programmations.find((item) => item.school_year === schoolYear);
  const programmation = matchingProgrammation
    ? await loadProgrammation(matchingProgrammation.id)
    : programmations[0]
      ? await loadProgrammation(programmations[0].id)
      : null;

  let progression = null;
  if (programmation) {
    const { data: progressions } = await supabase
      .from("progressions")
      .select("id")
      .eq("programmation_id", programmation.programmation.id)
      .eq("status", "validated")
      .order("created_at", { ascending: false })
      .limit(1);

    if (progressions?.[0]?.id) {
      progression = await loadProgression(progressions[0].id);
    }
  }

  const { data: agendaEvents } = await supabase
    .from("agenda_events")
    .select("*")
    .gte("start_at", `${calendar.rentree}T00:00:00`)
    .lte("start_at", `${calendar.finAnnee}T23:59:59`)
    .order("start_at");

  const timetableHours =
    (programmation?.programmation.timetable as { weeklyHoursBySubject?: Record<string, number> })
      ?.weeklyHoursBySubject ??
    bundle?.profile.timetables?.[0]?.timetable?.weeklyHoursBySubject;

  const base = buildPlannerPayload({
    calendar,
    programmation,
    progression,
    agendaEvents: (agendaEvents ?? []).map((row) => ({
      id: String(row.id),
      teacherProfileId: row.teacher_profile_id ? String(row.teacher_profile_id) : null,
      schoolYear: String(row.school_year ?? ""),
      title: String(row.title ?? ""),
      description: String(row.description ?? ""),
      eventType: String(row.event_type ?? "personnel") as never,
      categoryCode: String(row.category_code ?? "personnel"),
      startAt: String(row.start_at ?? ""),
      endAt: String(row.end_at ?? ""),
      allDay: Boolean(row.all_day),
      location: String(row.location ?? ""),
      color: "lavender",
      icon: String(row.icon ?? "calendar"),
      sourceModule: String(row.source_module ?? "manual"),
      sourceId: String(row.source_id ?? ""),
      status: String(row.status ?? "confirmed"),
      durationMinutes: Number(row.duration_minutes ?? 60),
      auto108h: Boolean(row.auto_108h),
      hours108EntryId: row.hours_108_entry_id ? String(row.hours_108_entry_id) : null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      created_at: String(row.created_at ?? ""),
      updated_at: String(row.updated_at ?? ""),
    })),
    profile: {
      prenom: bundle?.profile.prenom ?? "",
      levels: bundle?.profile.levels ?? [],
      schoolYear,
      zone,
    },
    timetableHours,
  });

  const intelligence = analyzePlanner(base);

  return {
    ...base,
    ...intelligence,
  };
}
