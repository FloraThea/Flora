import { supabase } from "@/lib/supabase";
import { getSupabaseErrorMessage, serializeSupabaseError } from "@/lib/supabase-errors";
import {
  getActiveBoDocument,
  getLatestReadyBoDocument,
} from "./bo-document-service";
import { inferCycleFromLevels } from "./bo-cycle-utils";
import type { ReferentielCompetence } from "@/lib/programming/types";
import type { BoReferenceDraft } from "@/lib/thea/analyseBoDocument";

export type ReferentielRow = {
  id: string;
  created_at?: string;
  niveau: string | null;
  discipline: string | null;
  domaine: string | null;
  sous_domaine?: string | null;
  competence: string | null;
  sous_competence?: string | null;
  code: string | null;
  cycle?: string | null;
  source_document?: string | null;
  document_source_id?: string | null;
  section?: string | null;
  source_excerpt?: string | null;
  competence_type?: string | null;
};

function normalizeDiscipline(value: string | null | undefined): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function matchesMatiere(discipline: string | null | undefined, matiere: string): boolean {
  const normalizedDiscipline = normalizeDiscipline(discipline);
  const normalizedMatiere = normalizeDiscipline(matiere);

  if (!normalizedMatiere || normalizedMatiere === "toutes les matieres") {
    return true;
  }

  if (!normalizedDiscipline) return false;

  return (
    normalizedDiscipline.includes(normalizedMatiere) ||
    normalizedMatiere.includes(normalizedDiscipline)
  );
}

export function mapReferentielRow(row: ReferentielRow): ReferentielCompetence {
  return {
    id: row.id,
    competence: row.competence ?? "",
    code: row.code ?? null,
    discipline: row.discipline ?? null,
    domaine: row.domaine ?? null,
    niveau: row.niveau ?? null,
    section: row.section ?? null,
    competenceType: row.competence_type ?? null,
    documentSourceId: row.document_source_id ?? null,
  };
}

async function resolveBoDocumentSourceId(
  matiere: string,
  cycle?: string,
): Promise<string | null> {
  const active = await getActiveBoDocument(matiere, cycle);
  if (active) return active.id;

  const latest = await getLatestReadyBoDocument(matiere, cycle);
  return latest?.id ?? null;
}

export async function loadReferentielCompetences(options?: {
  levels?: string[];
  matiere?: string;
  ids?: string[];
  label?: string;
  documentSourceId?: string | null;
  requireBoDocument?: boolean;
  cycle?: string;
}): Promise<ReferentielCompetence[]> {
  const levels = options?.levels ?? [];
  const matiere = options?.matiere ?? "";
  const label = options?.label ?? "referentiel";
  const cycle =
    options?.cycle ||
    inferCycleFromLevels(levels) ||
    undefined;

  let documentSourceId = options?.documentSourceId ?? null;

  if (documentSourceId === undefined || documentSourceId === null) {
    documentSourceId = await resolveBoDocumentSourceId(matiere, cycle);
  }

  let query = supabase.from("referentiels").select("*").order("sort_order", { ascending: true });

  if (options?.ids && options.ids.length > 0) {
    query = query.in("id", options.ids);
  } else if (documentSourceId) {
    query = query.eq("document_source_id", documentSourceId);
  } else if (options?.requireBoDocument) {
    console.warn(`[${label}] Aucun document BO actif — référentiel vide`);
    return [];
  }

  const { data, error } = await query;

  if (error) {
    console.error(`[${label}] Erreur chargement référentiel`, serializeSupabaseError(error));
    return [];
  }

  const rows = (data ?? []) as ReferentielRow[];
  const filtered = rows
    .filter((row) => {
      const matchesLevel =
        levels.length === 0 || levels.includes(String(row.niveau ?? "")) || row.niveau === "Non précisé";
      const matchesSubject = matchesMatiere(row.discipline, matiere);
      return matchesLevel && matchesSubject;
    })
    .map(mapReferentielRow)
    .filter((row) => row.competence);

  console.info(`[${label}] Référentiel chargé`, {
    totalRows: rows.length,
    filteredRows: filtered.length,
    levels,
    matiere: matiere || "toutes",
    documentSourceId,
    disciplines: [...new Set(filtered.map((row) => row.discipline).filter(Boolean))],
    sections: [...new Set(filtered.map((row) => row.section).filter(Boolean))],
  });

  return filtered;
}

export function getImportedDisciplines(referentiel: ReferentielCompetence[]): string[] {
  return [...new Set(referentiel.map((row) => row.discipline).filter(Boolean))] as string[];
}

export async function saveBoReferences(input: {
  references: BoReferenceDraft[];
  sourceDocument: string;
  replaceDisciplines?: boolean;
}): Promise<{ inserted: ReferentielRow[]; replacedDisciplines: string[] }> {
  const rowsToInsert = input.references.map((row) => ({
    niveau: row.niveau || "Non précisé",
    discipline: row.matiere || "Non précisé",
    domaine: row.sousMatiere || null,
    sous_domaine: row.sousSousMatiere || null,
    competence: row.competence || "Compétence à vérifier",
    sous_competence: row.sousCompetence || null,
    code: row.code || null,
    cycle: row.cycle || null,
    source_document: input.sourceDocument || row.source || null,
  }));

  if (rowsToInsert.length === 0) {
    throw new Error("Aucune compétence détectée dans le document BO.");
  }

  const disciplines = [
    ...new Set(rowsToInsert.map((row) => row.discipline).filter(Boolean)),
  ];
  const replacedDisciplines: string[] = [];

  if (input.replaceDisciplines !== false) {
    for (const discipline of disciplines) {
      const { error: deleteError } = await supabase
        .from("referentiels")
        .delete()
        .eq("discipline", discipline);

      if (deleteError) {
        console.error("[referentiel] Echec remplacement discipline", {
          discipline,
          error: serializeSupabaseError(deleteError),
        });
        throw new Error(
          getSupabaseErrorMessage(
            deleteError,
            `Impossible de remplacer le référentiel pour ${discipline}.`,
          ),
        );
      }

      replacedDisciplines.push(discipline);
    }
  }

  const { data, error } = await supabase.from("referentiels").insert(rowsToInsert).select("*");

  if (error) {
    console.error("[referentiel] Echec insertion Supabase", serializeSupabaseError(error));
    throw new Error(getSupabaseErrorMessage(error, "Insertion Supabase échouée."));
  }

  console.info("[referentiel] Insertion Supabase réussie", {
    insertedCount: data?.length ?? 0,
    replacedDisciplines,
    disciplines,
    sourceDocument: input.sourceDocument,
  });

  return {
    inserted: (data ?? []) as ReferentielRow[],
    replacedDisciplines,
  };
}

export async function listReferentielRows(): Promise<ReferentielRow[]> {
  const { data, error } = await supabase
    .from("referentiels")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[referentiel] Erreur listage", serializeSupabaseError(error));
    throw new Error(getSupabaseErrorMessage(error, "Impossible de charger les référentiels."));
  }

  return (data ?? []) as ReferentielRow[];
}
