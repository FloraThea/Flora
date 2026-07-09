import { supabase } from "@/lib/supabase";
import { chunkDocumentText } from "@/lib/documents/chunk-text";
import {
  canAnalyzeExtension,
  DocumentExtractionError,
  extractTextFromFile,
} from "@/lib/documents/extract-text";
import type {
  DocumentChunk,
  DocumentCompetence,
  DocumentTag,
  FloraDocument,
} from "@/lib/documents/types";
import {
  getFileExtension,
  isAcceptedResourceFile,
  isComingSoonExtension,
} from "@/lib/documents/types";
import { runKnowledgePipeline } from "@/lib/knowledge/pipeline";
import { analyseResourceWithThea } from "@/lib/thea/analyseResource";

import { getStorageBucketName } from "@/lib/supabase/storage-config";

export type ImportDocumentResponse = {
  success: boolean;
  document: FloraDocument;
  chunks: DocumentChunk[];
  tags: DocumentTag[];
  competences: DocumentCompetence[];
  warning?: string;
  message?: string;
};

function buildStoragePath(filename: string): string {
  const safeName = filename.replace(/[^\w.\- ]+/g, "_");
  return `${Date.now()}-${safeName}`;
}

async function insertCompetences(
  documentId: string,
  competences: Array<{
    competence: string;
    code_bo: string;
    matiere: string;
    sous_matiere: string;
    niveau: string;
  }>,
): Promise<DocumentCompetence[]> {
  const rows = competences.filter((item) => item.competence.trim());

  if (rows.length === 0) return [];

  const { data, error } = await supabase
    .from("document_competences")
    .insert(
      rows.map((item) => ({
        document_id: documentId,
        competence: item.competence,
        code_bo: item.code_bo,
        matiere: item.matiere,
        sous_matiere: item.sous_matiere,
        niveau: item.niveau,
      })),
    )
    .select();

  if (error) {
    throw error;
  }

  return (data ?? []) as DocumentCompetence[];
}

async function loadDocumentRelations(documentId: string) {
  const [{ data: chunks }, { data: tags }] = await Promise.all([
    supabase
      .from("document_chunks")
      .select("*")
      .eq("document_id", documentId)
      .order("chunk_index"),
    supabase.from("document_tags").select("*").eq("document_id", documentId),
  ]);

  return {
    chunks: (chunks ?? []) as DocumentChunk[],
    tags: (tags ?? []) as DocumentTag[],
  };
}

export async function importDocumentFromFile(
  file: File,
): Promise<ImportDocumentResponse> {
  if (!isAcceptedResourceFile(file.name)) {
    throw new DocumentExtractionError(
      "Format non supporté. Formats acceptés : PDF, DOCX, PPTX, XLSX, TXT.",
    );
  }

  const extension = getFileExtension(file.name);
  const storagePath = buildStoragePath(file.name);

  const { error: uploadError } = await supabase.storage
    .from(getStorageBucketName())
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data: createdDocument, error: createError } = await supabase
    .from("documents")
    .insert({
      title: file.name.replace(/\.[^.]+$/, ""),
      original_filename: file.name,
      document_type: "",
      file_extension: extension.replace(".", ""),
      file_size: file.size,
      storage_path: storagePath,
      status: "uploaded",
      metadata: {
        content_type: file.type,
      },
    })
    .select()
    .single();

  if (createError || !createdDocument) {
    throw createError ?? new Error("Impossible de créer le document.");
  }

  const document = createdDocument as FloraDocument;

  if (isComingSoonExtension(extension)) {
    return {
      success: true,
      document,
      chunks: [],
      tags: [],
      competences: [],
      warning:
        "Format bientôt pris en charge. Le fichier est enregistré, mais l'analyse automatique n'est pas encore disponible pour ce format.",
      message: "Document importé sans analyse.",
    };
  }

  let extractedText = "";

  try {
    if (canAnalyzeExtension(extension)) {
      const extraction = await extractTextFromFile(file);
      extractedText = extraction.text;
    }
  } catch (error) {
    const warning =
      error instanceof DocumentExtractionError
        ? error.message
        : "Impossible d'extraire le texte du document.";

    return {
      success: true,
      document,
      chunks: [],
      tags: [],
      competences: [],
      warning,
      message: "Document importé sans analyse.",
    };
  }

  if (!extractedText.trim()) {
    return {
      success: true,
      document,
      chunks: [],
      tags: [],
      competences: [],
      warning: "Aucun texte exploitable n'a pu être extrait du document.",
      message: "Document importé sans analyse.",
    };
  }

  try {
    const analysis = await analyseResourceWithThea(extractedText);

    const { data: updatedDocument, error: updateError } = await supabase
      .from("documents")
      .update({
        title: analysis.title || document.title,
        document_type: analysis.document_type,
        cycle: analysis.cycle,
        niveau: analysis.niveau,
        matiere: analysis.matiere,
        sous_matiere: analysis.sous_matiere,
        methode: analysis.methode,
        auteur: analysis.auteur,
        editeur: analysis.editeur,
        annee: analysis.annee,
        resume: analysis.resume,
        status: "analysed",
        metadata: {
          ...(document.metadata ?? {}),
          tags_count: analysis.tags.length,
          competences_count: analysis.competences.length,
          sections_count: analysis.sections.length,
        },
      })
      .eq("id", document.id)
      .select()
      .single();

    if (updateError || !updatedDocument) {
      throw updateError ?? new Error("Impossible de mettre à jour le document.");
    }

    const competences = await insertCompetences(document.id, analysis.competences);

    await runKnowledgePipeline({
      documentId: document.id,
      text: extractedText,
      filename: file.name,
      analysis,
      existingMetadata: {
        ...(updatedDocument.metadata ?? {}),
        content_type: file.type,
      },
    });

    const relations = await loadDocumentRelations(document.id);

    return {
      success: true,
      document: updatedDocument as FloraDocument,
      chunks: relations.chunks,
      tags: relations.tags,
      competences,
      message:
        "Document analysé et indexé dans le moteur de connaissances pédagogiques.",
    };
  } catch (error) {
    console.error("Erreur analyse Théa / moteur connaissances :", error);

    try {
      const fallbackChunks = chunkDocumentText(extractedText);
      await supabase.from("document_chunks").delete().eq("document_id", document.id);
      if (fallbackChunks.length > 0) {
        await supabase.from("document_chunks").insert(
          fallbackChunks.map((chunk) => ({
            document_id: document.id,
            chunk_index: chunk.chunk_index,
            title: chunk.title,
            content: chunk.content,
            page_start: chunk.page_start,
            page_end: chunk.page_end,
            section_type: chunk.section_type,
            metadata: chunk.metadata,
          })),
        );
      }
    } catch (fallbackError) {
      console.error("Erreur fallback chunks :", fallbackError);
    }

    const relations = await loadDocumentRelations(document.id);

    return {
      success: true,
      document,
      chunks: relations.chunks,
      tags: relations.tags,
      competences: [],
      warning:
        "Le document a bien été importé, mais l'analyse complète n'a pas pu être terminée.",
      message: "Document importé sans analyse complète.",
    };
  }
}
