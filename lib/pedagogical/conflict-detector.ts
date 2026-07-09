import { supabase } from "@/lib/supabase";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import type { PedagogicalConflict } from "./types";

export async function detectPedagogicalConflicts(): Promise<PedagogicalConflict[]> {
  const conflicts: PedagogicalConflict[] = [];
  const bundle = await loadTeacherProfileBundle();

  if (!bundle) return conflicts;

  const calendar = schoolWeeksCalculator.calculate(
    bundle.profile.schoolYear,
    bundle.profile.zoneScolaire,
    { teacherWorkingDays: bundle.profile.workingDays },
  );

  const vacationRanges = calendar.vacations.map((item) => ({ start: item.start, end: item.end }));
  const nonWorkingDays = new Set(calendar.teacherWorkingDays.length > 0 ? [] : bundle.profile.workingDays);

  await detectSeanceWithoutCompetence(conflicts);
  await detectEmptyProgrammationCells(conflicts);
  await detectDuplicateTimetableSlots(conflicts);
  await detectSeancesDuringVacation(conflicts, vacationRanges);
  await detectOverloadedWeeks(conflicts);
  await detectIncompleteProgressions(conflicts);
  await detectSessionsOnNonWorkingDays(conflicts, nonWorkingDays, bundle.profile.workingDays);

  return conflicts;
}

async function detectSeanceWithoutCompetence(conflicts: PedagogicalConflict[]) {
  const { data } = await supabase
    .from("seances")
    .select("id, titre")
    .or("competence_bo.is.null,competence_bo.eq.")
    .limit(20);

  for (const seance of data ?? []) {
    conflicts.push({
      id: `seance-no-comp-${seance.id}`,
      code: "seance_sans_competence",
      severity: "warning",
      message: `Séance « ${seance.titre} » sans compétence associée.`,
      suggestion: "Associer une compétence du référentiel BO.",
      module: "seances",
      entityId: String(seance.id),
    });
  }
}

async function detectEmptyProgrammationCells(conflicts: PedagogicalConflict[]) {
  const { data } = await supabase.from("programming_cells").select("id, content, competences, modules");

  for (const cell of data ?? []) {
    const competences = (cell.competences as string[]) ?? [];
    const modules = (cell.modules as string[]) ?? [];
    const content = String(cell.content ?? "").trim();

    if (competences.length === 0 && modules.length === 0 && !content) {
      conflicts.push({
        id: `empty-cell-${cell.id}`,
        code: "programmation_vide",
        severity: "info",
        message: "Une cellule de programmation est vide.",
        suggestion: "Compléter la programmation ou fusionner les périodes.",
        module: "programmation",
        entityId: String(cell.id),
      });
    }
  }
}

async function detectDuplicateTimetableSlots(conflicts: PedagogicalConflict[]) {
  const { data: slots } = await supabase
    .from("timetable_slots")
    .select("id, day, start, end, subject, schedule_id");

  const seen = new Map<string, string>();

  for (const slot of slots ?? []) {
    const key = `${slot.schedule_id}:${slot.day}:${slot.start}`;
    if (seen.has(key)) {
      conflicts.push({
        id: `slot-dup-${slot.id}`,
        code: "creneau_duplique",
        severity: "error",
        message: `Deux séances au même créneau (${slot.day} ${slot.start}).`,
        suggestion: "Déplacer l'une des séances dans l'emploi du temps.",
        module: "emploi_du_temps",
        entityId: String(slot.id),
      });
    } else {
      seen.set(key, String(slot.id));
    }
  }
}

async function detectSeancesDuringVacation(
  conflicts: PedagogicalConflict[],
  vacationRanges: Array<{ start: string; end: string }>,
) {
  const { data: seances } = await supabase
    .from("seances")
    .select("id, titre, session_date")
    .not("session_date", "is", null);

  for (const seance of seances ?? []) {
    const date = String(seance.session_date);
    const duringVacation = vacationRanges.some(
      (range) => date >= range.start && date <= range.end,
    );
    if (duringVacation) {
      conflicts.push({
        id: `vacation-seance-${seance.id}`,
        code: "seance_pendant_vacances",
        severity: "error",
        message: `Séance « ${seance.titre} » planifiée pendant les vacances (${date}).`,
        suggestion: "Repositionner la séance sur une semaine de classe.",
        module: "seances",
        entityId: String(seance.id),
      });
    }
  }
}

async function detectOverloadedWeeks(conflicts: PedagogicalConflict[]) {
  const { data: rows } = await supabase
    .from("progression_rows")
    .select("period_number, week_number");

  const counts = new Map<string, number>();
  for (const row of rows ?? []) {
    const key = `${row.period_number}-${row.week_number}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (const [key, count] of counts) {
    if (count >= 12) {
      const [period, week] = key.split("-");
      conflicts.push({
        id: `overload-${key}`,
        code: "semaine_surchargee",
        severity: "warning",
        message: `Semaine ${week} (période ${period}) : ${count} séances planifiées.`,
        suggestion: "Répartir certaines séances sur d'autres semaines.",
        module: "progression",
        weekNumbers: [Number(week)],
      });
    }
  }
}

async function detectIncompleteProgressions(conflicts: PedagogicalConflict[]) {
  const { data } = await supabase
    .from("progressions")
    .select("id, title, validation, status")
    .eq("status", "draft");

  for (const progression of data ?? []) {
    conflicts.push({
      id: `progression-incomplete-${progression.id}`,
      code: "progression_incomplete",
      severity: "info",
      message: `Progression « ${progression.title} » non validée.`,
      suggestion: "Finaliser et valider la progression.",
      module: "progression",
      entityId: String(progression.id),
    });
  }
}

async function detectSessionsOnNonWorkingDays(
  conflicts: PedagogicalConflict[],
  nonWorkingDays: Set<string>,
  workingDays: string[],
) {
  if (workingDays.length === 0) return;

  const { data: slots } = await supabase.from("timetable_slots").select("id, day, subject");

  for (const slot of slots ?? []) {
    const day = String(slot.day);
    if (!workingDays.includes(day)) {
      conflicts.push({
        id: `non-working-${slot.id}`,
        code: "jour_non_travaille",
        severity: "error",
        message: `${slot.subject} planifié un ${day} (jour non travaillé).`,
        suggestion: "Adapter l'emploi du temps au profil enseignant.",
        module: "emploi_du_temps",
        entityId: String(slot.id),
      });
    }
    void nonWorkingDays;
  }
}
