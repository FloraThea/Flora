import { searchEngine } from "@/lib/knowledge/SearchEngine";
import { clearDocumentKnowledge } from "@/lib/knowledge/pipeline";
import { getSupabaseErrorMessage, serializeSupabaseError } from "@/lib/supabase-errors";
import { floraDb } from "@/lib/supabase/get-db";
import { getStorageBucketName } from "@/lib/supabase/storage-config";
import { requireTeacherScope } from "@/lib/tenant/teacher-context";
import { importQueue } from "./import/ImportQueue";
import { uploadManager } from "./import/UploadManager";
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

async function fetchDocumentsForSearch(profileId: string): Promise<DocumentWithOptionalRelations[]> {
  const { data, error } = await (await floraDb())
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("teacher_profile_id", profileId)
    .order("created_at", { ascending: false });

  if (!error) {
    return (data ?? []) as DocumentWithOptionalRelations[];
  }

  const supabaseError = serializeSupabaseError(error);
  console.warn("[documents] Jointure tags/compétences indisponible, repli sur select('*')", supabaseError);

  const fallback = await (await floraDb())
    .from("documents")
    .select("*")
    .eq("teacher_profile_id", profileId)
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
  const scope = await requireTeacherScope();

  const { data, error } = await (await floraDb())
    .from("documents")
    .select("*")
    .eq("teacher_profile_id", scope.profileId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return ((data ?? []) as FloraDocument[]).filter((document) => !isArchived(document));
}

export async function searchDocuments(
  filters: DocumentSearchFilters = {},
): Promise<FloraDocument[]> {
  const scope = await requireTeacherScope();
  const documents = (await fetchDocumentsForSearch(scope.profileId)).filter(
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
  const scope = await requireTeacherScope();

  const { data, error } = await (await floraDb())
    .from("documents")
    .select(
      `
        *,
        document_chunks(*),
        document_tags(*),
        document_competences(*),
        pedagogical_entities(*)
      `,
    )
    .eq("id", documentId)
    .eq("teacher_profile_id", scope.profileId)
    .single();

  if (!error && data) {
    const document = data as DocumentWithRelations;

    return {
      ...document,
      document_chunks: (document.document_chunks ?? []).sort(
        (a, b) => a.chunk_index - b.chunk_index,
      ),
      pedagogical_entities: document.pedagogical_entities ?? [],
    };
  }

  if (error) {
    console.warn(
      "[documents] Détails avec relations indisponibles, repli sur document seul",
      serializeSupabaseError(error),
    );
  }

  const fallback = await (await floraDb())
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("teacher_profile_id", scope.profileId)
    .single();

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
    pedagogical_entities: [],
  };
}

/** Suppression douce : conserve les données en base. */
export async function archiveDocument(documentId: string): Promise<FloraDocument> {
  const existing = await getDocumentDetails(documentId);

  if (!existing) {
    throw new Error("Document introuvable.");
  }

  const { data, error } = await (await floraDb())
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

async function removeDocumentStorageFiles(
  document: FloraDocument,
  extraPaths: string[] = [],
): Promise<void> {
  const bucket =
    (document.metadata?.storage_bucket as string | undefined) ?? getStorageBucketName();
  const paths = new Set<string>();

  if (document.storage_path?.trim()) {
    paths.add(document.storage_path.trim());
  }

  for (const path of extraPaths) {
    if (path.trim()) paths.add(path.trim());
  }

  if (paths.size === 0) return;

  const { error } = await (await floraDb()).storage.from(bucket).remove([...paths]);

  if (error) {
    console.warn("[documents] Suppression fichier storage ignorée", {
      documentId: document.id,
      paths: [...paths],
      error: getSupabaseErrorMessage(error, "Suppression storage échouée"),
    });
  }
}

/** Suppression définitive : document, fichier source et analyse associée. */
export async function deleteDocument(documentId: string): Promise<void> {
  const existing = await getDocumentDetails(documentId);

  if (!existing) {
    throw new Error("Document introuvable.");
  }

  await importQueue.cancelForDocument(documentId);

  const { data: uploadSessions, error: sessionsError } = await (await floraDb())
    .from("document_upload_sessions")
    .select("id")
    .eq("document_id", documentId);

  if (sessionsError) throw sessionsError;

  for (const session of uploadSessions ?? []) {
    await uploadManager.cancelSession(String(session.id));
  }

  const { data: versions, error: versionsError } = await (await floraDb())
    .from("document_versions")
    .select("storage_path")
    .eq("document_id", documentId);

  if (versionsError) throw versionsError;

  const versionPaths = (versions ?? [])
    .map((row) => String(row.storage_path ?? ""))
    .filter(Boolean);

  await removeDocumentStorageFiles(existing, versionPaths);
  await clearDocumentKnowledge(documentId);

  const { error: segmentsError } = await (await floraDb())
    .from("document_segments")
    .delete()
    .eq("document_id", documentId);

  if (segmentsError) {
    throw new Error(
      getSupabaseErrorMessage(segmentsError, "Impossible de supprimer les segments analysés."),
    );
  }

  const { error } = await (await floraDb()).from("documents").delete().eq("id", documentId);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de supprimer le document."));
  }
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
