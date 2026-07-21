import type { DocumentExtractionResult } from "@/lib/documents/extraction/types";
import { runBoAnalyzeStepProgressive } from "./bo-analyze-progressive";
import {
  activateBoDocument,
  countBoCompetences,
  createBoDocument,
  getBoDocumentById,
  tryUploadBoFileOptional,
  updateBoDocument,
} from "./bo-document-service";
import { inferNiveauxFromCycle } from "./bo-cycle-utils";
import { inferBoMetadata, splitBoTextIntoSections } from "./bo-section-splitter";
import type { BoImportResult } from "./bo-types";
import { validateBoExtraction } from "./bo-validator";

/** Étape 1–2 : import fichier + extraction texte (sans IA). */
export async function runBoImportAndExtractStep(input: {
  file: File;
  extraction: DocumentExtractionResult;
}): Promise<BoImportResult> {
  const metadata = inferBoMetadata(input.extraction.text);
  const upload = await tryUploadBoFileOptional(input.file);

  let document = await createBoDocument({
    file: input.file,
    storagePath: upload.storagePath,
    pdfArchived: upload.archived,
    storageBucket: upload.bucket,
    cycle: metadata.cycle,
    matiere: metadata.matiere,
    domaine: metadata.domaine,
    niveau: inferNiveauxFromCycle(metadata.cycle),
    extractedText: input.extraction.text,
    textLength: input.extraction.textLength,
    pageCount: input.extraction.pageCount,
    extractionMethod: input.extraction.extractionMethod,
    status: "TEXT_EXTRACTED",
    metadata: {
      document_type: "bo_officiel",
      pdf_archived: upload.archived,
      storage_bucket: upload.bucket,
      storage_path: upload.storagePath,
    },
  });

  const validation = validateBoExtraction({
    competences: [],
    sections: splitBoTextIntoSections(input.extraction.text),
    matiere: metadata.matiere,
  });

  if (upload.warning) {
    validation.warnings.push(upload.warning);
  }

  document = await updateBoDocument(document.id, {
    status: "TEXT_EXTRACTED",
    validation,
    metadata: {
      ...(document.metadata ?? {}),
      extractionMethod: input.extraction.extractionMethod,
      usedOcr: input.extraction.usedOcr,
      preview: input.extraction.preview,
    },
  });

  return {
    document,
    competences: [],
    validation,
    insertedCount: 0,
    sectionsProcessed: [],
    storageWarning: upload.warning,
    pdfArchived: upload.archived,
    storageBucket: upload.bucket,
    savedToLibrary: false,
  };
}

/** Étape 3 : analyse Théa progressive (relançable). */
export async function runBoAnalyzeStep(documentId: string): Promise<BoImportResult> {
  return runBoAnalyzeStepProgressive(documentId);
}

/** Analyse complète depuis un fichier (import + extract + analyze). */
export async function runBoAnalysePipeline(input: {
  file: File;
  extraction: DocumentExtractionResult;
}): Promise<BoImportResult> {
  const imported = await runBoImportAndExtractStep(input);
  return runBoAnalyzeStep(imported.document.id);
}

export async function finalizeBoReferentiel(documentId: string): Promise<BoImportResult> {
  const document = await getBoDocumentById(documentId);

  if (!document) {
    throw new Error("Document BO introuvable.");
  }

  const competenceCount = await countBoCompetences(documentId);

  if (competenceCount === 0) {
    throw new Error("Aucune compétence à enregistrer pour ce référentiel.");
  }

  const validation =
    document.validation && typeof document.validation === "object" && "totalCompetences" in document.validation
      ? (document.validation as BoImportResult["validation"])
      : validateBoExtraction({
          competences: [],
          sections: [],
          matiere: document.matiere,
        });

  const updated = await updateBoDocument(documentId, {
    status: "READY",
    validation: {
      ...validation,
      totalCompetences: competenceCount,
    },
    metadata: {
      ...(document.metadata ?? {}),
      savedToLibrary: true,
      savedAt: new Date().toISOString(),
      insertedCount: competenceCount,
      validatedAt: new Date().toISOString(),
    },
  });

  return {
    document: updated,
    competences: [],
    validation: {
      ...validation,
      totalCompetences: competenceCount,
    },
    insertedCount: competenceCount,
    sectionsProcessed: Array.isArray(updated.metadata?.sectionsProcessed)
      ? (updated.metadata.sectionsProcessed as string[])
      : [],
    savedToLibrary: true,
  };
}

export async function runBoImportPipeline(input: {
  file: File;
  extraction: DocumentExtractionResult;
  autoActivate?: boolean;
}): Promise<BoImportResult> {
  const analysed = await runBoAnalysePipeline(input);
  const saved = await finalizeBoReferentiel(analysed.document.id);

  let document = saved.document;

  if (input.autoActivate !== false) {
    document = await activateBoDocument(document.id);
  }

  return {
    ...analysed,
    document,
    savedToLibrary: true,
    insertedCount: saved.insertedCount,
  };
}
