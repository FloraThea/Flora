import "server-only";

import { floraDb } from "@/lib/supabase/get-db";
import { loadReferentielCompetences } from "@/lib/referentiel/referentiel-service";
import { onlyActive } from "@/lib/trash/active-query";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import type { CompetenceCoverage } from "../types";
import type { BoCoverageReport } from "./types";

export async function computeBoCoverageReport(matiere?: string): Promise<BoCoverageReport> {
  const scope = await requireTeacherScope();
  const referentiel = await loadReferentielCompetences({ matiere });

  const coveredMap = new Map<string, { label: string; modules: Set<string>; count: number }>();

  const { data: progressionRows } = await (await floraDb())
    .from("progression_rows")
    .select("referentiel_ids, competence_bo, progression_id");

  const { data: ownedProgressions } = await onlyActive(
    (await floraDb()).from("progressions").select("id").eq("teacher_profile_id", scope.profileId),
  );
  const ownedIds = new Set((ownedProgressions ?? []).map((row) => String(row.id)));

  for (const row of progressionRows ?? []) {
    if (!ownedIds.has(String(row.progression_id))) continue;
    const ids = (row.referentiel_ids as string[]) ?? [];
    for (const id of ids) {
      const current = coveredMap.get(id) ?? { label: id, modules: new Set(), count: 0 };
      current.modules.add("progression");
      current.count += 1;
      coveredMap.set(id, current);
    }
    const label = String(row.competence_bo ?? "").trim();
    if (label) {
      const ref = referentiel.find((item) => item.competence.toLowerCase() === label.toLowerCase());
      if (ref) {
        const current = coveredMap.get(ref.id) ?? { label: ref.competence, modules: new Set(), count: 0 };
        current.modules.add("progression");
        current.count += 1;
        coveredMap.set(ref.id, current);
      }
    }
  }

  const { data: seances } = await onlyActive(
    (await floraDb()).from("seances").select("referentiel_ids").eq("teacher_profile_id", scope.profileId),
  );

  for (const seance of seances ?? []) {
    for (const id of (seance.referentiel_ids as string[]) ?? []) {
      const current = coveredMap.get(id) ?? { label: id, modules: new Set(), count: 0 };
      current.modules.add("seances");
      current.count += 1;
      coveredMap.set(id, current);
    }
  }

  const covered: CompetenceCoverage[] = [];
  const partial: CompetenceCoverage[] = [];
  const missing: CompetenceCoverage[] = [];
  const duplicate: BoCoverageReport["duplicate"] = [];

  for (const ref of referentiel) {
    const hit = coveredMap.get(ref.id);
    if (!hit) {
      missing.push({
        referentielId: ref.id,
        label: ref.competence,
        status: "missing",
        modules: [],
      });
      continue;
    }

    const modules = [...hit.modules] as CompetenceCoverage["modules"];
    if (hit.count > 1) {
      duplicate.push({
        referentielId: ref.id,
        label: ref.competence,
        status: "covered",
        modules,
        occurrences: hit.count,
      });
    }

    if (modules.length === 1) {
      partial.push({
        referentielId: ref.id,
        label: ref.competence,
        status: "partial",
        modules,
      });
    } else {
      covered.push({
        referentielId: ref.id,
        label: ref.competence,
        status: "covered",
        modules,
      });
    }
  }

  const totalCompetences = referentiel.length;
  const coveragePercent =
    totalCompetences === 0
      ? 0
      : Math.round(((covered.length + partial.length * 0.5) / totalCompetences) * 100);

  return {
    covered,
    partial,
    missing,
    duplicate,
    coveragePercent,
    totalCompetences,
  };
}
