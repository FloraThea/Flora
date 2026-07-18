import { floraDb } from "@/lib/supabase/get-db";
import { getSupabaseErrorMessage, serializeSupabaseError } from "@/lib/supabase-errors";
import { buildBoStoragePath, getStorageBucketName } from "@/lib/supabase/storage-config";
import { checkStorageBucketExists } from "@/lib/supabase/storage-health";
import type { BoCompetenceDraft, BoDocumentRow, BoDocumentStatus, BoValidationReport } from "./bo-types";
import { normalizeBoDocumentStatus } from "./bo-status";

export type BoFileUploadResult = {
  storagePath: string | null;
  archived: boolean;
  warning: string | null;
  bucket: string;
};

export async function tryUploadBoFileOptional(file: File): Promise<BoFileUploadResult> {
  const bucket = getStorageBucketName();
  const exists = await checkStorageBucketExists(bucket);

  if (!exists) {
    return {
      bucket,
      storagePath: null,
      archived: false,
      warning: `Le bucket Supabase « ${bucket} » est introuvable. Le PDF n'a pas été archivé ; le texte extrait et les compétences seront enregistrés.`,
    };
  }

  const storagePath = buildBoStoragePath(file.name);
  const { error } = await (await floraDb()).storage.from(bucket).upload(storagePath, file, {
    contentType: file.type || "application/pdf",
    upsert: false,
  });

  if (error) {
    const message = getSupabaseErrorMessage(error, error.message);
    console.warn("[bo-document] Archivage PDF ignoré", {
      bucket,
      storagePath,
      error: message,
    });

    return {
      bucket,
      storagePath: null,
      archived: false,
      warning: `Archivage PDF impossible (${message}). Le référentiel BO sera créé sans copie du fichier.`,
    };
  }

  return {
    bucket,
    storagePath,
    archived: true,
    warning: null,
  };
}

/** @deprecated Préférer tryUploadBoFileOptional — l'archivage ne doit pas bloquer l'import. */
export async function uploadBoFile(file: File): Promise<string> {
  const result = await tryUploadBoFileOptional(file);
  if (!result.storagePath) {
    throw new Error(result.warning ?? "Impossible d'enregistrer le fichier BO.");
  }
  return result.storagePath;
}

export async function markBoDocumentError(
  documentId: string,
  errorMessage: string,
  fallbackStatus: BoDocumentStatus = "ERROR",
): Promise<BoDocumentRow> {
  return updateBoDocument(documentId, {
    status: fallbackStatus === "TEXT_EXTRACTED" ? "TEXT_EXTRACTED" : "ERROR",
    error_message: errorMessage,
    metadata: { lastErrorAt: new Date().toISOString() },
  });
}

export async function createBoDocument(input: {
  file: File;
  storagePath?: string | null;
  pdfArchived?: boolean;
  storageBucket?: string;
  cycle: string;
  matiere: string;
  domaine: string;
  niveau?: string;
  extractedText: string;
  textLength: number;
  pageCount: number | null;
  extractionMethod: string;
  status?: BoDocumentStatus;
  metadata?: Record<string, unknown>;
}): Promise<BoDocumentRow> {
  const extension = input.file.name.slice(input.file.name.lastIndexOf(".")).replace(".", "");

  const { data, error } = await (await floraDb())
    .from("bo_documents")
    .insert({
      original_filename: input.file.name,
      storage_path: input.storagePath ?? "",
      file_extension: extension,
      file_size: input.file.size,
      cycle: input.cycle,
      matiere: input.matiere,
      domaine: input.domaine,
      niveau: input.niveau ?? "",
      extracted_text: input.extractedText,
      text_length: input.textLength,
      page_count: input.pageCount,
      extraction_method: input.extractionMethod,
      status: input.status ?? "UPLOADED",
      document_type: "bo_officiel",
      original_name: input.file.name,
      error_message: "",
      metadata: {
        content_type: input.file.type,
        pdf_archived: input.pdfArchived ?? Boolean(input.storagePath),
        storage_bucket: input.storageBucket ?? getStorageBucketName(),
        ...(input.metadata ?? {}),
      },
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de créer le document BO."));
  }

  return data as BoDocumentRow;
}

export async function updateBoDocument(
  documentId: string,
  patch: Partial<{
    status: BoDocumentStatus;
    validation: BoValidationReport;
    active_for_programmation: boolean;
    metadata: Record<string, unknown>;
    extracted_text: string;
    text_length: number;
    page_count: number | null;
    extraction_method: string;
    error_message: string;
    cycle: string;
    matiere: string;
    domaine: string;
    niveau: string;
    storage_url: string;
  }>,
): Promise<BoDocumentRow> {
  const metadata = patch.metadata ?? undefined;
  const errorMessage =
    patch.error_message ??
    (metadata?.error_message as string | undefined);

  const { data, error } = await (await floraDb())
    .from("bo_documents")
    .update({
      ...patch,
      error_message: errorMessage ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de mettre à jour le document BO."));
  }

  return data as BoDocumentRow;
}

export async function saveBoCompetences(input: {
  documentId: string;
  competences: BoCompetenceDraft[];
}): Promise<number> {
  const { error: deleteError } = await (await floraDb())
    .from("referentiels")
    .delete()
    .eq("document_source_id", input.documentId);

  if (deleteError) {
    throw new Error(
      getSupabaseErrorMessage(deleteError, "Impossible de remplacer les compétences existantes."),
    );
  }

  if (input.competences.length === 0) {
    return 0;
  }

  const rows = input.competences.map((item, index) => ({
    document_source_id: input.documentId,
    cycle: item.cycle || null,
    niveau: item.niveau || "Non précisé",
    discipline: item.matiere || "Français",
    domaine: item.domaine || item.section,
    sous_domaine: item.sousDomaine || null,
    competence: item.competence,
    sous_competence: item.sousCompetence || null,
    code: item.code || null,
    section: item.section,
    source_excerpt: item.sourceExcerpt || null,
    competence_type: item.competenceType,
    source_document: null,
    sort_order: index + 1,
    metadata: {
      section_id: item.sectionId,
      sort_order: index + 1,
    },
  }));

  const { data, error } = await (await floraDb()).from("referentiels").insert(rows).select("id");

  if (error) {
    console.error("[bo-document] Echec insertion compétences", serializeSupabaseError(error));
    throw new Error(getSupabaseErrorMessage(error, "Insertion des compétences échouée."));
  }

  return data?.length ?? 0;
}

export async function countBoCompetences(documentId: string): Promise<number> {
  const { count, error } = await (await floraDb())
    .from("referentiels")
    .select("id", { count: "exact", head: true })
    .eq("document_source_id", documentId);

  if (error) {
    console.error("[bo-document] Echec comptage compétences", serializeSupabaseError(error));
    return 0;
  }

  return count ?? 0;
}

export async function getBoDocumentById(documentId: string): Promise<BoDocumentRow | null> {
  const { data, error } = await (await floraDb())
    .from("bo_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Document BO introuvable."));
  }

  return (data as BoDocumentRow | null) ?? null;
}

export async function getActiveBoDocument(
  matiere?: string,
  cycle?: string,
): Promise<BoDocumentRow | null> {
  let query = (await floraDb())
    .from("bo_documents")
    .select("*")
    .eq("active_for_programmation", true)
    .in("status", ["READY", "VALIDATED", "ready"])
    .order("updated_at", { ascending: false })
    .limit(1);

  if (matiere) {
    query = query.ilike("matiere", `%${matiere}%`);
  }

  if (cycle) {
    query = query.ilike("cycle", `%${cycle.replace("cycle ", "")}%`);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[bo-document] Erreur chargement BO actif", serializeSupabaseError(error));
    return null;
  }

  return (data as BoDocumentRow | null) ?? null;
}

export async function getLatestReadyBoDocument(
  matiere?: string,
  cycle?: string,
): Promise<BoDocumentRow | null> {
  let query = (await floraDb())
    .from("bo_documents")
    .select("*")
    .in("status", ["READY", "VALIDATED", "ready"])
    .order("updated_at", { ascending: false })
    .limit(1);

  if (matiere) {
    query = query.ilike("matiere", `%${matiere}%`);
  }

  if (cycle) {
    query = query.ilike("cycle", `%${cycle.replace("cycle ", "")}%`);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return null;
  }

  return (data as BoDocumentRow | null) ?? null;
}

export async function activateBoDocument(documentId: string): Promise<BoDocumentRow> {
  const document = await getBoDocumentById(documentId);
  if (!document) {
    throw new Error("Document BO introuvable.");
  }

  if (normalizeBoDocumentStatus(document.status) !== "READY" &&
      normalizeBoDocumentStatus(document.status) !== "VALIDATED") {
    throw new Error("Seul un référentiel validé peut être activé pour les programmations.");
  }

  const { error: resetError } = await (await floraDb())
    .from("bo_documents")
    .update({ active_for_programmation: false, updated_at: new Date().toISOString() })
    .eq("matiere", document.matiere);

  if (resetError) {
    throw new Error(getSupabaseErrorMessage(resetError, "Impossible de réinitialiser l'activation."));
  }

  return updateBoDocument(documentId, { active_for_programmation: true });
}

export async function getBoDocumentStatus(documentId?: string): Promise<{
  document: BoDocumentRow | null;
  competenceCount: number;
  sections: string[];
}> {
  let document: BoDocumentRow | null = null;

  if (documentId) {
    document = await getBoDocumentById(documentId);
  } else {
    document = (await getActiveBoDocument()) ?? (await getLatestReadyBoDocument());
  }

  if (!document) {
    return { document: null, competenceCount: 0, sections: [] };
  }

  const { data, error } = await (await floraDb())
    .from("referentiels")
    .select("section")
    .eq("document_source_id", document.id);

  if (error) {
    return { document, competenceCount: 0, sections: [] };
  }

  const sections = [
    ...new Set((data ?? []).map((row) => String(row.section ?? "")).filter(Boolean)),
  ];

  return {
    document,
    competenceCount: data?.length ?? 0,
    sections,
  };
}

export async function listBoDocuments(): Promise<BoDocumentRow[]> {
  const { data, error } = await (await floraDb())
    .from("bo_documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de lister les documents BO."));
  }

  return (data ?? []) as BoDocumentRow[];
}

export async function listBoDocumentsWithCounts(): Promise<
  Array<BoDocumentRow & { competence_count: number }>
> {
  const documents = await listBoDocuments();

  const enriched = await Promise.all(
    documents.map(async (document) => ({
      ...document,
      competence_count: await countBoCompetences(document.id),
    })),
  );

  return enriched;
}

export async function deleteBoDocument(documentId: string): Promise<void> {
  const document = await getBoDocumentById(documentId);
  if (!document) {
    throw new Error("Document BO introuvable.");
  }

  const { error: competencesError } = await (await floraDb())
    .from("referentiels")
    .delete()
    .eq("document_source_id", documentId);

  if (competencesError) {
    throw new Error(
      getSupabaseErrorMessage(competencesError, "Impossible de supprimer les compétences liées."),
    );
  }

  if (document.storage_path) {
    const bucket =
      (document.metadata?.storage_bucket as string | undefined) ?? getStorageBucketName();
    const { error: storageError } = await (await floraDb()).storage
      .from(bucket)
      .remove([document.storage_path]);

    if (storageError) {
      console.warn("[bo-document] Suppression fichier storage ignorée", {
        documentId,
        storagePath: document.storage_path,
        error: getSupabaseErrorMessage(storageError, "Suppression storage échouée"),
      });
    }
  }

  const { error } = await (await floraDb()).from("bo_documents").delete().eq("id", documentId);

  if (error) {
    throw new Error(getSupabaseErrorMessage(error, "Impossible de supprimer le document BO."));
  }
}
