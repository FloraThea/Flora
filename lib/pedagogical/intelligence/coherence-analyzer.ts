import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { schoolWeeksCalculator } from "@/lib/programming/SchoolWeeksCalculator";
import { loadTeacherProfileBundle } from "@/lib/profile/profile-service";
import { onlyActive } from "@/lib/trash/active-query";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { detectPedagogicalConflicts } from "../conflict-detector";
import {
  coherenceCacheKey,
  getPedagogicalCache,
  setPedagogicalCache,
} from "./coherence-cache";
import type { CoherenceIssue } from "./types";

function toIssue(
  conflict: Awaited<ReturnType<typeof detectPedagogicalConflicts>>[number],
  reason: string,
  sources: CoherenceIssue["sources"],
  proposal?: string,
): CoherenceIssue {
  return {
    ...conflict,
    reason,
    sources,
    proposal: proposal ?? conflict.suggestion,
  };
}

export async function analyzePedagogicalCoherence(): Promise<CoherenceIssue[]> {
  const scope = await requireTeacherScope();
  const cached = getPedagogicalCache<CoherenceIssue[]>(coherenceCacheKey(scope.profileId));
  if (cached) return cached;

  const base = await detectPedagogicalConflicts();
  const issues: CoherenceIssue[] = base.map((item) =>
    toIssue(item, "Règle de cohérence Flora détectée.", [
      { module: item.module, entityId: item.entityId, label: item.message },
    ]),
  );

  await detectSequenceWithoutSeance(scope.profileId, issues);
  await detectSeanceWithoutObjectif(scope.profileId, issues);
  await detectProgrammationWithoutProgression(scope.profileId, issues);
  await detectDuplicateTitles(scope.profileId, issues);
  await detectProgressionYearCoverage(scope.profileId, issues);
  await detectForgottenCompetences(scope.profileId, issues);
  await detectDateInconsistencies(scope.profileId, issues);
  await detectMissingDurations(scope.profileId, issues);
  await detectLevelDomainGaps(scope.profileId, issues);

  setPedagogicalCache(coherenceCacheKey(scope.profileId), issues, 120_000);
  return issues;
}

async function detectSequenceWithoutSeance(profileId: string, issues: CoherenceIssue[]) {
  const { data: sequences } = await onlyActive(
    (await floraDb())
      .from("sequences")
      .select("id, title, session_count, matiere")
      .eq("teacher_profile_id", profileId),
  );

  for (const sequence of sequences ?? []) {
    const { count } = await onlyActive(
      (await floraDb())
        .from("seances")
        .select("id", { count: "exact", head: true })
        .eq("sequence_id", sequence.id),
    );

    if ((count ?? 0) === 0 && Number(sequence.session_count ?? 0) > 0) {
      issues.push({
        id: `sequence-no-seance-${sequence.id}`,
        code: "sequence_sans_seance",
        severity: "warning",
        message: `Séquence « ${sequence.title} » sans séance créée.`,
        suggestion: "Générer ou créer les séances de cette séquence.",
        module: "progression",
        entityId: String(sequence.id),
        reason: "La séquence prévoit des sessions mais aucune séance n'est enregistrée.",
        sources: [{ module: "progression", entityId: String(sequence.id), label: sequence.title }],
        proposal: "Créer les séances depuis la séquence ou ajuster le nombre de sessions.",
      });
    }
  }
}

async function detectSeanceWithoutObjectif(profileId: string, issues: CoherenceIssue[]) {
  const { data } = await onlyActive(
    (await floraDb())
      .from("seances")
      .select("id, title, objectif, matiere")
      .eq("teacher_profile_id", profileId)
      .or("objectif.is.null,objectif.eq."),
  ).limit(30);

  for (const seance of data ?? []) {
    issues.push({
      id: `seance-no-objectif-${seance.id}`,
      code: "seance_sans_objectif",
      severity: "warning",
      message: `Séance « ${seance.title} » sans objectif renseigné.`,
      suggestion: "Compléter l'objectif pédagogique de la séance.",
      module: "seances",
      entityId: String(seance.id),
      reason: "Une séance sans objectif rend difficile le suivi de l'année.",
      sources: [{ module: "seances", entityId: String(seance.id), label: seance.title }],
      proposal: "Renseigner l'objectif à partir de la progression ou du fichier importé.",
    });
  }
}

async function detectProgrammationWithoutProgression(profileId: string, issues: CoherenceIssue[]) {
  const { data: programmations } = await onlyActive(
    (await floraDb())
      .from("programmations")
      .select("id, title, matiere, source_type")
      .eq("teacher_profile_id", profileId),
  );

  for (const prog of programmations ?? []) {
    const { count } = await onlyActive(
      (await floraDb())
        .from("progressions")
        .select("id", { count: "exact", head: true })
        .eq("programmation_id", prog.id),
    );

    if ((count ?? 0) === 0 && prog.source_type === "imported") {
      issues.push({
        id: `prog-no-progression-${prog.id}`,
        code: "programmation_sans_progression",
        severity: "info",
        message: `Programmation « ${prog.title} » importée sans progression associée.`,
        suggestion: "Importer ou générer une progression pour cette programmation.",
        module: "programmation",
        entityId: String(prog.id),
        reason: "Une programmation seule ne permet pas de suivre le déroulé hebdomadaire.",
        sources: [{ module: "programmation", entityId: String(prog.id), label: prog.title }],
        proposal: "Importer une progression dans la même matière ou la générer depuis la programmation.",
      });
    }
  }
}

async function detectDuplicateTitles(profileId: string, issues: CoherenceIssue[]) {
  const tables = [
    { module: "programmation" as const, table: "programmations" },
    { module: "progression" as const, table: "progressions" },
  ];

  for (const entry of tables) {
    const { data } = await onlyActive(
      (await floraDb())
        .from(entry.table)
        .select("id, title")
        .eq("teacher_profile_id", profileId),
    );

    const counts = new Map<string, string[]>();
    for (const row of data ?? []) {
      const key = String(row.title ?? "").trim().toLowerCase();
      if (!key) continue;
      const bucket = counts.get(key) ?? [];
      bucket.push(String(row.id));
      counts.set(key, bucket);
    }

    for (const [title, ids] of counts) {
      if (ids.length < 2) continue;
      issues.push({
        id: `duplicate-${entry.module}-${title.slice(0, 20)}`,
        code: "doublon_titre",
        severity: "info",
        message: `${ids.length} documents « ${title} » dans ${entry.module}.`,
        suggestion: "Vérifier s'il s'agit de doublons d'import ou de versions différentes.",
        module: entry.module,
        reason: "Des titres identiques peuvent créer une confusion dans la navigation par matière.",
        sources: ids.map((id) => ({ module: entry.module, entityId: id, label: title })),
        proposal: "Renommer ou placer l'un des doublons dans la Corbeille.",
      });
    }
  }
}

async function detectProgressionYearCoverage(profileId: string, issues: CoherenceIssue[]) {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) return;

  const calendar = schoolWeeksCalculator.calculate(
    bundle.profile.schoolYear,
    bundle.profile.zoneScolaire,
    { teacherWorkingDays: bundle.profile.workingDays },
  );

  const expectedWeeks = calendar.schoolWeeks.filter((week) => week.teacherWorkingDaysInWeek > 0).length;

  const { data: progressions } = await onlyActive(
    (await floraDb())
      .from("progressions")
      .select("id, title, matiere")
      .eq("teacher_profile_id", profileId),
  );

  for (const progression of progressions ?? []) {
    const { data: rows } = await (await floraDb())
      .from("progression_rows")
      .select("week_number, period_number")
      .eq("progression_id", progression.id);

    const weeks = new Set((rows ?? []).map((row) => `${row.period_number}-${row.week_number}`));
    const ratio = weeks.size / Math.max(expectedWeeks, 1);

    if (ratio < 0.5 && (rows?.length ?? 0) > 0) {
      issues.push({
        id: `progression-short-${progression.id}`,
        code: "progression_incomplete_annee",
        severity: "warning",
        message: `Progression « ${progression.title} » couvre ${weeks.size}/${expectedWeeks} semaines travaillées.`,
        suggestion: "Compléter la progression pour couvrir l'année scolaire.",
        module: "progression",
        entityId: String(progression.id),
        reason: "Le nombre de semaines renseignées est inférieur à la moitié de l'année scolaire.",
        sources: [{ module: "progression", entityId: String(progression.id), label: progression.title }],
        proposal: "Importer les semaines manquantes ou étendre la progression existante.",
      });
    }
  }
}

async function detectForgottenCompetences(profileId: string, issues: CoherenceIssue[]) {
  const { data: ownedProgs } = await onlyActive(
    (await floraDb()).from("programmations").select("id").eq("teacher_profile_id", profileId),
  );
  const ownedProgIds = [...new Set((ownedProgs ?? []).map((row) => String(row.id)))];
  if (ownedProgIds.length === 0) return;

  const { data: tables } = await (await floraDb())
    .from("programming_tables")
    .select("id, programmation_id")
    .in("programmation_id", ownedProgIds);

  const tableToProg = new Map((tables ?? []).map((row) => [String(row.id), String(row.programmation_id)]));
  const tableIds = [...tableToProg.keys()];
  if (tableIds.length === 0) return;

  const { data: progCells } = await (await floraDb())
    .from("programming_cells")
    .select("id, competences, table_id")
    .in("table_id", tableIds)
    .not("competences", "eq", "[]");

  const programmed = new Set<string>();
  for (const cell of progCells ?? []) {
    const progId = tableToProg.get(String(cell.table_id));
    if (!progId || !ownedProgIds.includes(progId)) continue;
    for (const label of (cell.competences as string[]) ?? []) {
      if (label.trim()) programmed.add(label.trim().toLowerCase());
    }
  }

  const { data: rows } = await (await floraDb())
    .from("progression_rows")
    .select("competence_bo, progression_id")
    .not("competence_bo", "is", null);

  const { data: ownedProgressions } = await onlyActive(
    (await floraDb()).from("progressions").select("id").eq("teacher_profile_id", profileId),
  );
  const ownedProgressionIds = new Set((ownedProgressions ?? []).map((row) => String(row.id)));

  for (const row of rows ?? []) {
    if (!ownedProgressionIds.has(String(row.progression_id))) continue;
    const label = String(row.competence_bo ?? "").trim();
    if (!label) continue;
    if (programmed.has(label.toLowerCase())) continue;

    issues.push({
      id: `competence-oubliee-${label.slice(0, 24)}-${row.progression_id}`,
      code: "competence_oubliee",
      severity: "info",
      message: `Compétence « ${label} » présente en progression mais absente de la programmation.`,
      suggestion: "Vérifier la cohérence programmation ↔ progression.",
      module: "progression",
      entityId: String(row.progression_id),
      reason: "La compétence apparaît dans la progression sans équivalent identifié en programmation.",
      sources: [{ module: "progression", entityId: String(row.progression_id), label }],
      proposal: "Ajouter la compétence à la programmation ou corriger la progression.",
    });
    break;
  }
}

async function detectDateInconsistencies(profileId: string, issues: CoherenceIssue[]) {
  const bundle = await loadTeacherProfileBundle();
  if (!bundle) return;

  const calendar = schoolWeeksCalculator.calculate(
    bundle.profile.schoolYear,
    bundle.profile.zoneScolaire,
    { teacherWorkingDays: bundle.profile.workingDays },
  );

  const validWeekKeys = new Set(
    calendar.schoolWeeks
      .filter((week) => week.teacherWorkingDaysInWeek > 0)
      .flatMap((week) => {
        const period = calendar.periods.find((item) =>
          item.schoolWeeks.some((entry) => entry.weekNumberInYear === week.weekNumberInYear),
        );
        const periodNumber = period?.periodNumber ?? 1;
        return [`${periodNumber}-${week.weekNumberInPeriod}`, String(week.weekNumberInYear)];
      }),
  );

  const { data: seances } = await onlyActive(
    (await floraDb())
      .from("seances")
      .select("id, title, period_number, week_number, session_date, matiere")
      .eq("teacher_profile_id", profileId)
      .limit(200),
  );

  for (const seance of seances ?? []) {
    const key = `${seance.period_number}-${seance.week_number}`;
    if (Number(seance.week_number ?? 0) > 0 && !validWeekKeys.has(key)) {
      issues.push({
        id: `date-incoherent-${seance.id}`,
        code: "incoherence_date",
        severity: "warning",
        message: `Séance « ${seance.title} » sur une semaine/période incohérente (P${seance.period_number} S${seance.week_number}).`,
        suggestion: "Vérifier la période et la semaine dans la progression source.",
        module: "seances",
        entityId: String(seance.id),
        reason: "La semaine indiquée ne correspond pas au calendrier scolaire actif.",
        sources: [{ module: "seances", entityId: String(seance.id), label: seance.title }],
        proposal: "Repositionner la séance sur une semaine valide du calendrier.",
      });
    }

    const date = seance.session_date ? String(seance.session_date) : "";
    if (date && (date < calendar.rentree || date > calendar.finAnnee)) {
      issues.push({
        id: `date-hors-annee-${seance.id}`,
        code: "incoherence_date",
        severity: "error",
        message: `Séance « ${seance.title} » datée du ${date}, hors année scolaire.`,
        suggestion: "Corriger la date de séance.",
        module: "seances",
        entityId: String(seance.id),
        reason: "La date est en dehors de la rentrée et de la fin d'année scolaires.",
        sources: [{ module: "seances", entityId: String(seance.id), label: seance.title }],
        proposal: "Ajuster la date selon le calendrier de l'année en cours.",
      });
    }
  }
}

async function detectMissingDurations(profileId: string, issues: CoherenceIssue[]) {
  const { data } = await onlyActive(
    (await floraDb())
      .from("seances")
      .select("id, title, duree_minutes, matiere")
      .eq("teacher_profile_id", profileId)
      .or("duree_minutes.is.null,duree_minutes.eq.0")
      .limit(20),
  );

  for (const seance of data ?? []) {
    issues.push({
      id: `seance-no-duree-${seance.id}`,
      code: "duree_manquante",
      severity: "info",
      message: `Séance « ${seance.title} » sans durée renseignée.`,
      suggestion: "Indiquer la durée prévue (ex. 45 min).",
      module: "seances",
      entityId: String(seance.id),
      reason: "Sans durée, Flora ne peut pas calculer le temps prévu de l'année.",
      sources: [{ module: "seances", entityId: String(seance.id), label: seance.title }],
      proposal: "Compléter la durée à partir du fichier importé ou de l'emploi du temps.",
    });
  }
}

async function detectLevelDomainGaps(profileId: string, issues: CoherenceIssue[]) {
  const bundle = await loadTeacherProfileBundle();
  const profileLevels = new Set((bundle?.profile.levels ?? []).map((level) => level.toLowerCase()));

  const { data: progressions } = await onlyActive(
    (await floraDb())
      .from("progressions")
      .select("id, title, niveau, matiere")
      .eq("teacher_profile_id", profileId),
  );

  for (const progression of progressions ?? []) {
    const niveau = String(progression.niveau ?? "").trim();
    if (niveau && profileLevels.size > 0 && !profileLevels.has(niveau.toLowerCase())) {
      issues.push({
        id: `niveau-incoherent-${progression.id}`,
        code: "niveau_incoherent",
        severity: "info",
        message: `Progression « ${progression.title} » en ${niveau}, différent du profil (${[...profileLevels].join(", ")}).`,
        suggestion: "Vérifier le niveau de la progression importée.",
        module: "progression",
        entityId: String(progression.id),
        reason: "Le niveau du document ne correspond pas aux niveaux du profil enseignant.",
        sources: [{ module: "progression", entityId: String(progression.id), label: progression.title }],
        proposal: "Ajuster le niveau ou confirmer qu'il s'agit d'un document transversal.",
      });
    }
  }

  const { data: rows } = await (await floraDb())
    .from("progression_rows")
    .select("id, competence_bo, objectifs, progression_id")
    .not("competence_bo", "is", null)
    .limit(500);

  const ownedIds = new Set((progressions ?? []).map((row) => String(row.id)));
  let missingObjectifCount = 0;

  for (const row of rows ?? []) {
    if (!ownedIds.has(String(row.progression_id))) continue;
    const competence = String(row.competence_bo ?? "").trim();
    const objectifs = (row.objectifs as string[]) ?? [];
    if (!competence || objectifs.length > 0) continue;
    missingObjectifCount += 1;
    if (missingObjectifCount > 3) break;

    issues.push({
      id: `objectif-manquant-${row.id}`,
      code: "objectif_manquant",
      severity: "info",
      message: `Compétence « ${competence} » sans objectif opérationnel.`,
      suggestion: "Compléter les objectifs pour faciliter le suivi pédagogique.",
      module: "progression",
      entityId: String(row.progression_id),
      reason: "Une compétence sans objectif rend le pilotage hebdomadaire moins précis.",
      sources: [{ module: "progression", entityId: String(row.progression_id), label: competence }],
      proposal: "Reprendre les objectifs depuis le fichier importé.",
    });
  }
}
