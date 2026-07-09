import { searchEngine } from "@/lib/knowledge/SearchEngine";
import { getSupabaseErrorMessage, serializeSupabaseError } from "@/lib/supabase-errors";
import { supabase } from "@/lib/supabase";
import type {
  DocumentSearchFilters,
  DocumentWithRelations,
  FloraDocument,
} from "./types";

const DOCUMENT_SELECT = `
  *,
  document_tags(tag),
  document_competences(competence, code_bo, matiere, sous_matiere, niveau)
`;

type DocumentWithOptionalRelations = FloraDocument & {
  document_tags?: Array<{ tag: string }>;
  document_competences?: Array<{ competence: string; code_bo: string }>;
};

async function fetchDocumentsForSearch(): Promise<DocumentWithOptionalRelations[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .order("created_at", { ascending: false });

  if (!error) {
    return (data ?? []) as DocumentWithOptionalRelations[];
  }

  const supabaseError = serializeSupabaseError(error);
  console.warn("[documents] Jointure tags/compétences indisponible, repli sur select('*')", supabaseError);

  const fallback = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (fallback.error) {
    console.error("[documents] Échec du repli select('*')", serializeSupabaseError(fallback.error));
    throw fallback.error;
  }

  return (fallback.data ?? []) as DocumentWithOptionalRelations[];
}

/** Exclut les documents archivés (suppression douce). */
function isArchived(document: FloraDocument): boolean {
  return Boolean(document.metadata?.archived);
}

function normalizeQuery(query?: string): string {
  return (query ?? "").trim().toLowerCase();
}

function matchesDocumentSearch(
  document: FloraDocument & {
    document_tags?: Array<{ tag: string }>;
    document_competences?: Array<{ competence: string; code_bo: string }>;
  },
  filters: DocumentSearchFilters,
): boolean {
  if (isArchived(document)) return false;

  const query = normalizeQuery(filters.query);
  const haystack = [
    document.title,
    document.original_filename,
    document.document_type,
    document.matiere,
    document.sous_matiere,
    document.methode,
    document.cycle,
    document.niveau,
    document.resume,
    document.auteur,
    document.editeur,
    ...(document.document_tags?.map((tag) => tag.tag) ?? []),
    ...(document.document_competences?.map((item) => item.competence) ?? []),
    ...(document.document_competences?.map((item) => item.code_bo) ?? []),
  ]
    .join(" ")
    .toLowerCase();

  const matchesQuery =
    !query || query.split(/\s+/).every((term) => haystack.includes(term));

  const matchesType =
    !filters.type || filters.type === "Tous" || document.document_type === filters.type;
  const matchesMatiere =
    !filters.matiere ||
    filters.matiere === "Toutes" ||
    document.matiere === filters.matiere;
  const matchesSousMatiere =
    !filters.sousMatiere ||
    filters.sousMatiere === "Toutes" ||
    document.sous_matiere === filters.sousMatiere;
  const matchesNiveau =
    !filters.niveau ||
    filters.niveau === "Tous" ||
    document.niveau === filters.niveau;
  const matchesCycle =
    !filters.cycle || filters.cycle === "Tous" || document.cycle === filters.cycle;
  const matchesMethode =
    !filters.methode ||
    filters.methode === "Toutes" ||
    document.methode === filters.methode;

  return (
    matchesQuery &&
    matchesType &&
    matchesMatiere &&
    matchesSousMatiere &&
    matchesNiveau &&
    matchesCycle &&
    matchesMethode
  );
}

export async function listDocuments(): Promise<FloraDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as FloraDocument[]).filter((document) => !isArchived(document));
}

export async function searchDocuments(
  filters: DocumentSearchFilters = {},
): Promise<FloraDocument[]> {
  const documents = (await fetchDocumentsForSearch()).filter(
    (document) => !isArchived(document),
  );

  const query = normalizeQuery(filters.query);
  const filteredWithoutQuery = documents.filter((document) =>
    matchesDocumentSearch(document, { ...filters, query: "" }),
  );

  if (!query) {
    return filteredWithoutQuery;
  }

  const intelligentResults = await searchEngine.search(query, 50);
  const scoreByDocumentId = new Map(
    intelligentResults.map((result) => [result.documentId, result.score]),
  );

  const matched = filteredWithoutQuery.filter((document) => {
    const haystackMatch = matchesDocumentSearch(document, filters);
    const indexMatch = scoreByDocumentId.has(document.id);
    return haystackMatch || indexMatch;
  });

  return matched.sort((left, right) => {
    const leftScore = scoreByDocumentId.get(left.id) ?? 0;
    const rightScore = scoreByDocumentId.get(right.id) ?? 0;
    if (leftScore !== rightScore) return rightScore - leftScore;
    return (
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  });
}

export async function getDocumentDetails(
  documentId: string,
): Promise<DocumentWithRelations | null> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      `
        *,
        document_chunks(*),
        document_tags(*),
        document_competences(*)
      `,
    )
    .eq("id", documentId)
    .single();

  if (!error && data) {
    const document = data as DocumentWithRelations;

    return {
      ...document,
      document_chunks: (document.document_chunks ?? []).sort(
        (a, b) => a.chunk_index - b.chunk_index,
      ),
    };
  }

  if (error) {
    console.warn(
      "[documents] Détails avec relations indisponibles, repli sur document seul",
      serializeSupabaseError(error),
    );
  }

  const fallback = await supabase.from("documents").select("*").eq("id", documentId).single();

  if (fallback.error || !fallback.data) {
    if (fallback.error) {
      console.error("[documents] Échec chargement document", serializeSupabaseError(fallback.error));
    }
    return null;
  }

  const base = fallback.data as FloraDocument;

  return {
    ...base,
    document_chunks: [],
    document_tags: [],
    document_competences: [],
  };
}

/** Suppression douce : conserve les données en base. */
export async function archiveDocument(documentId: string): Promise<FloraDocument> {
  const existing = await getDocumentDetails(documentId);

  if (!existing) {
    throw new Error("Document introuvable.");
  }

  const { data, error } = await supabase
    .from("documents")
    .update({
      metadata: {
        ...(existing.metadata ?? {}),
        archived: true,
        archived_at: new Date().toISOString(),
      },
    })
    .eq("id", documentId)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error("Impossible d'archiver le document.");
  }

  return data as FloraDocument;
}

export function buildFilterOptions(documents: FloraDocument[]) {
  const types = new Set<string>();
  const matieres = new Set<string>();
  const sousMatieres = new Set<string>();
  const niveaux = new Set<string>();
  const cycles = new Set<string>();
  const methodes = new Set<string>();

  documents.forEach((document) => {
    if (document.document_type) types.add(document.document_type);
    if (document.matiere) matieres.add(document.matiere);
    if (document.sous_matiere) sousMatieres.add(document.sous_matiere);
    if (document.niveau) niveaux.add(document.niveau);
    if (document.cycle) cycles.add(document.cycle);
    if (document.methode) methodes.add(document.methode);
  });

  return {
    types: ["Tous", ...Array.from(types)],
    matieres: ["Toutes", ...Array.from(matieres)],
    sousMatieres: ["Toutes", ...Array.from(sousMatieres)],
    niveaux: ["Tous", ...Array.from(niveaux)],
    cycles: ["Tous", ...Array.from(cycles)],
    methodes: ["Toutes", ...Array.from(methodes)],
  };
}
