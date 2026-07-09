import { CompetenceMatcher } from "@/lib/knowledge/CompetenceMatcher";
import { supabase } from "@/lib/supabase";

const matcher = new CompetenceMatcher();

/**
 * Résout les libellés de compétences en identifiants référentiel uniques.
 * Source unique de vérité : le référentiel BO.
 */
export async function resolveReferentielIds(labels: string[]): Promise<string[]> {
  if (labels.length === 0) return [];

  const referentiels = await matcher.loadReferentiels();
  const ids = new Set<string>();

  for (const label of labels) {
    const match = matcher.matchCompetence(label, referentiels);
    if (match.referentielId) ids.add(match.referentielId);
  }

  return [...ids];
}

export async function syncCellReferentielIds(cellId: string, competenceLabels: string[]): Promise<string[]> {
  const referentielIds = await resolveReferentielIds(competenceLabels);

  await supabase
    .from("programming_cells")
    .update({
      referentiel_ids: referentielIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", cellId);

  return referentielIds;
}

export async function propagateReferentielIdsToProgressionRows(
  cellId: string,
  referentielIds: string[],
  competenceLabels: string[],
): Promise<number> {
  const primaryLabel = competenceLabels[0] ?? "";

  const { data: rows } = await supabase
    .from("progression_rows")
    .select("id")
    .eq("programming_cell_id", cellId);

  if (!rows?.length) return 0;

  const { error } = await supabase
    .from("progression_rows")
    .update({
      referentiel_ids: referentielIds,
      competence_bo: primaryLabel,
      updated_at: new Date().toISOString(),
    })
    .in(
      "id",
      rows.map((row) => row.id),
    );

  if (error) throw error;
  return rows.length;
}

export async function propagateReferentielIdsToSeances(
  progressionRowIds: string[],
  referentielIds: string[],
  competenceLabel: string,
): Promise<number> {
  if (progressionRowIds.length === 0) return 0;

  const { data: seances } = await supabase
    .from("seances")
    .select("id")
    .in("progression_row_id", progressionRowIds);

  if (!seances?.length) return 0;

  const { error } = await supabase
    .from("seances")
    .update({
      referentiel_ids: referentielIds,
      competence_bo: competenceLabel,
      updated_at: new Date().toISOString(),
    })
    .in(
      "id",
      seances.map((row) => row.id),
    );

  if (error) throw error;
  return seances.length;
}

export async function propagateReferentielIdsToJournal(referentielIds: string[]): Promise<number> {
  if (referentielIds.length === 0) return 0;

  const { data: seances } = await supabase
    .from("seances")
    .select("id")
    .contains("referentiel_ids", [referentielIds[0]]);

  if (!seances?.length) return 0;

  const seanceIds = seances.map((row) => row.id);
  const { data: entries } = await supabase
    .from("journal_entries")
    .select("id, seance_id")
    .in("seance_id", seanceIds);

  if (!entries?.length) return 0;

  let count = 0;
  for (const entry of entries) {
    const { error } = await supabase
      .from("journal_entries")
      .update({ referentiel_ids: referentielIds, updated_at: new Date().toISOString() })
      .eq("id", entry.id);
    if (!error) count += 1;
  }

  return count;
}

export async function getProgrammationIdForCell(cellId: string): Promise<string | null> {
  const { data: cell } = await supabase
    .from("programming_cells")
    .select("table_id")
    .eq("id", cellId)
    .maybeSingle();

  if (!cell?.table_id) return null;

  const { data: table } = await supabase
    .from("programming_tables")
    .select("programmation_id")
    .eq("id", cell.table_id)
    .maybeSingle();

  return table?.programmation_id ? String(table.programmation_id) : null;
}
