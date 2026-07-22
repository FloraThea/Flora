import { floraDb } from "@/lib/supabase/get-db";
import { readDocumentStorageProvider, storageService } from "@/lib/storage";
import { AiExhaustedError } from "@/lib/thea/orchestrator";
import { AI_QUEUE_USER_MESSAGE } from "@/lib/thea/messages";
import {
  canAnalyzeExtension,
  DocumentExtractionError,
  extractTextFromBuffer,
} from "../extract-text";
import type { FloraDocument } from "../types";
import { getFileExtension, isComingSoonExtension } from "../types";
import { documentClassifier } from "./DocumentClassifier";
import { IMPORT_CONFIG } from "./config";
import { failImportPipeline } from "./import-error-diagnostics";
import { metadataExtractor } from "./MetadataExtractor";
import { notificationManager } from "./NotificationManager";
import { segmentBuilder, vectorIndexer } from "./SegmentBuilder";
import type { DocumentMetadataDraft, ImportJob } from "./types";
import type { analyseResourceWithThea, TheaResourceAnalysis } from "@/lib/thea/analyseResource";

export type AnalysisCheckpoint = {
  extractedText: string;
  classifiedType: string;
  metadata: DocumentMetadataDraft;
  pageCount: number | null;
  usedOcr: boolean;
  geminiDeferCount: number;
};

type JobMetadata = ImportJob["metadata"] & {
  analysisCheckpoint?: AnalysisCheckpoint;
  geminiRetryAfter?: string;
};

async function loadDocumentFile(document: FloraDocument): Promise<{ buffer: Buffer; extension: string }> {
  const provider = readDocumentStorageProvider(document.metadata);
  const downloaded = await storageService.download(
    document.storage_path,
    {
      documentId: document.id,
      fileName: document.original_filename,
      userId: typeof document.metadata?.user_id === "string" ? document.metadata.user_id : undefined,
    },
    provider,
  );

  return {
    buffer: downloaded.body,
    extension: getFileExtension(document.original_filename),
  };
}

export class DocumentAnalyzer {
  async analyzeDocument(documentId: string, job: ImportJob): Promise<void> {
    const checkpoint = (job.metadata as JobMetadata).analysisCheckpoint;
    if (checkpoint) {
      await this.resumeFromCheckpoint(documentId, job, checkpoint);
      return;
    }

    const { data: documentRow, error } = await (await floraDb())
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error || !documentRow) {
      failImportPipeline(
        { step: "database_query", table: "documents", documentId, jobId: job.id },
        error ?? new Error("Document introuvable."),
      );
    }

    const document = documentRow as FloraDocument;
    const extension = getFileExtension(document.original_filename);

    if (isComingSoonExtension(extension)) {
      await this.updateJob(job.id, {
        status: "completed",
        progress: 100,
        stageLabel: "Enregistré (analyse format bientôt disponible)",
      });
      await notificationManager.notify({
        documentId,
        jobId: job.id,
        type: "document_ready",
        message: `${document.original_filename} est disponible (analyse du format prochainement).`,
      });
      return;
    }

    await this.updateJob(job.id, { status: "extracting", progress: 15, stageLabel: "Extraction du texte…" });

    const { buffer } = await loadDocumentFile(document);
    let extractedText = "";
    let pageCount: number | null = null;
    let usedOcr = false;

    if (canAnalyzeExtension(extension)) {
      try {
        const extraction = await extractTextFromBuffer(buffer, document.original_filename);
        extractedText = extraction.text;
        pageCount = extraction.pageCount;
        usedOcr = Boolean(extraction.usedOcr);

        console.info("[import-pipeline] Extraction terminée", {
          documentId,
          jobId: job.id,
          fileName: document.original_filename,
          fileSizeBytes: document.file_size,
          pageCount: extraction.pageCount,
          textLength: extraction.textLength,
          extractionMethod: extraction.extractionMethod,
          usedOcr: extraction.usedOcr,
          pdfKind: extraction.pdfKind ?? null,
          hasTextLayer: extraction.hasTextLayer ?? null,
          durationMs: extraction.diagnostics?.durationMs ?? null,
        });
      } catch (error) {
        failImportPipeline(
          {
            step: "extraction",
            documentId,
            jobId: job.id,
            fileName: document.original_filename,
            fileSizeBytes: document.file_size,
            extra:
              error instanceof DocumentExtractionError
                ? {
                    extractionReason: error.reason,
                    pageCount: error.pageCount,
                    textLength: error.textLength,
                  }
                : undefined,
          },
          error instanceof DocumentExtractionError ? error : error,
        );
      }
    }

    if (!extractedText.trim()) {
      failImportPipeline(
        {
          step: "extraction",
          documentId,
          jobId: job.id,
          fileName: document.original_filename,
          fileSizeBytes: document.file_size,
        },
        new Error("Aucun texte exploitable après extraction."),
      );
    }

    const classifiedType = documentClassifier.classify({
      filename: document.original_filename,
      text: extractedText,
      currentType: document.document_type,
    });

    const metadata = metadataExtractor.extract({
      filename: document.original_filename,
      text: extractedText,
      pageCount,
      fileSize: document.file_size,
    });

    await this.runAnalysisPhase(document, job, {
      extractedText,
      classifiedType,
      metadata,
      pageCount,
      usedOcr,
      geminiDeferCount: 0,
    });
  }

  private async resumeFromCheckpoint(
    documentId: string,
    job: ImportJob,
    checkpoint: AnalysisCheckpoint,
  ): Promise<void> {
    const { data: documentRow, error } = await (await floraDb())
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error || !documentRow) {
      failImportPipeline(
        { step: "database_query", table: "documents", documentId, jobId: job.id },
        error ?? new Error("Document introuvable."),
      );
    }

    await this.updateJob(job.id, {
      status: "analyzing",
      progress: 55,
      stageLabel: "Reprise de l'analyse pédagogique…",
    });

    await this.runAnalysisPhase(documentRow as FloraDocument, job, checkpoint);
  }

  private async runAnalysisPhase(
    document: FloraDocument,
    job: ImportJob,
    checkpoint: AnalysisCheckpoint,
  ): Promise<void> {
    const documentId = document.id;

    await this.updateJob(job.id, { status: "analyzing", progress: 55, stageLabel: "Analyse pédagogique…" });

    let analysisResult;

    try {
      analysisResult = await vectorIndexer.analyzeWithThea(checkpoint.extractedText);
    } catch (error) {
      if (error instanceof AiExhaustedError) {
        await this.deferToGeminiQueue(document, job, checkpoint);
        return;
      }

      failImportPipeline(
        { step: "analysis", documentId, jobId: job.id, fileName: document.original_filename },
        error,
      );
    }

    const { error: documentUpdateError } = await (await floraDb())
      .from("documents")
      .update({
        title: analysisResult.title || checkpoint.metadata.title || document.title,
        document_type:
          checkpoint.classifiedType || analysisResult.document_type || checkpoint.metadata.documentType,
        cycle: analysisResult.cycle || checkpoint.metadata.cycle,
        niveau: analysisResult.niveau || checkpoint.metadata.niveau,
        matiere: analysisResult.matiere || checkpoint.metadata.discipline,
        sous_matiere: analysisResult.sous_matiere,
        methode: analysisResult.methode || checkpoint.metadata.methode,
        auteur: analysisResult.auteur || checkpoint.metadata.auteur,
        editeur: analysisResult.editeur || checkpoint.metadata.editeur,
        annee: analysisResult.annee || checkpoint.metadata.annee,
        resume: analysisResult.resume,
        status: "analysed",
        metadata: {
          ...(document.metadata ?? {}),
          langue: checkpoint.metadata.langue,
          page_count: checkpoint.pageCount,
          image_count: checkpoint.metadata.imageCount,
          table_count: checkpoint.metadata.tableCount,
          used_ocr: checkpoint.usedOcr,
          import_analyzed_at: new Date().toISOString(),
          analysisCheckpoint: null,
          geminiRetryAfter: null,
        },
      })
      .eq("id", documentId);

    if (documentUpdateError) {
      failImportPipeline(
        { step: "database_update", table: "documents", documentId, jobId: job.id },
        documentUpdateError,
      );
    }

    await this.runIndexingPhase({
      document,
      job,
      documentId,
      extractedText: checkpoint.extractedText,
      classifiedType: checkpoint.classifiedType,
      metadata: checkpoint.metadata,
      analysisResult,
    });
  }

  /** Reprend l'indexation lorsqu'un job était bloqué après l'analyse Théa. */
  async resumeIndexingPhase(documentId: string, job: ImportJob): Promise<void> {
    const { data: documentRow, error } = await (await floraDb())
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error || !documentRow) {
      failImportPipeline(
        { step: "database_query", table: "documents", documentId, jobId: job.id },
        error ?? new Error("Document introuvable."),
      );
    }

    const document = documentRow as FloraDocument;
    const metadata = (document.metadata ?? {}) as Record<string, unknown>;
    const checkpoint = metadata.analysisCheckpoint as AnalysisCheckpoint | undefined;

    let extractedText = checkpoint?.extractedText ?? "";
    if (!extractedText.trim()) {
      const { buffer, extension } = await loadDocumentFile(document);
      if (canAnalyzeExtension(extension)) {
        const extraction = await extractTextFromBuffer(buffer, document.original_filename);
        extractedText = extraction.text;
      }
    }

    if (!extractedText.trim()) {
      failImportPipeline(
        { step: "vectorization", documentId, jobId: job.id, fileName: document.original_filename },
        new Error("Texte introuvable pour reprendre l'indexation."),
      );
    }

    const analysisResult: TheaResourceAnalysis = {
      title: document.title,
      document_type: document.document_type,
      cycle: document.cycle,
      niveau: document.niveau,
      matiere: document.matiere,
      sous_matiere: document.sous_matiere,
      methode: document.methode,
      auteur: document.auteur,
      editeur: document.editeur,
      annee: document.annee,
      resume: document.resume,
      tags: [],
      competences: [],
      sections: [],
    };

    await this.runIndexingPhase({
      document,
      job,
      documentId,
      extractedText,
      classifiedType: checkpoint?.classifiedType ?? document.document_type,
      metadata: checkpoint?.metadata ?? {
        title: document.title,
        documentType: document.document_type,
        discipline: document.matiere,
        niveau: document.niveau,
        methode: document.methode,
        cycle: document.cycle,
        langue: String(metadata.langue ?? ""),
        pageCount: Number(metadata.page_count ?? null) || null,
        imageCount: Number(metadata.image_count ?? 0),
        tableCount: Number(metadata.table_count ?? 0),
        auteur: document.auteur,
        editeur: document.editeur,
        annee: document.annee,
      },
      analysisResult,
    });
  }

  private async runIndexingPhase(input: {
    document: FloraDocument;
    job: ImportJob;
    documentId: string;
    extractedText: string;
    classifiedType: string;
    metadata: AnalysisCheckpoint["metadata"];
    analysisResult: TheaResourceAnalysis;
  }): Promise<void> {
    const { document, job, documentId, extractedText, classifiedType, metadata, analysisResult } =
      input;

    await this.updateJob(job.id, {
      status: "indexing",
      progress: 80,
      stageLabel: "Découpage et indexation…",
      metadata: {},
    });

    const segments = segmentBuilder.buildSegments(extractedText, {
      filename: document.original_filename,
      documentType: classifiedType,
      discipline: analysisResult.matiere || metadata.discipline,
      niveau: analysisResult.niveau || metadata.niveau,
      methode: analysisResult.methode || metadata.methode,
      analysis: analysisResult,
    });

    await this.updateJob(job.id, {
      status: "indexing",
      progress: 86,
      stageLabel: "Enregistrement des segments…",
    });

    await segmentBuilder.persistSegments(documentId, segments);

    await this.updateJob(job.id, {
      status: "indexing",
      progress: 92,
      stageLabel: "Indexation pédagogique…",
    });

    try {
      await vectorIndexer.indexDocument({
        documentId,
        text: extractedText,
        filename: document.original_filename,
        analysis: analysisResult,
        metadata: document.metadata ?? {},
        skipAiExtraction: true,
      });
    } catch (error) {
      failImportPipeline(
        { step: "vectorization", documentId, jobId: job.id, fileName: document.original_filename },
        error,
      );
    }

    await this.updateJob(job.id, {
      status: "completed",
      progress: 100,
      stageLabel: "Document disponible",
      completedAt: new Date().toISOString(),
      metadata: {},
    });

    await notificationManager.notify({
      documentId,
      jobId: job.id,
      type: "indexing_complete",
      message: `${document.original_filename} est disponible dans votre bibliothèque.`,
    });
  }

  private async deferToGeminiQueue(
    document: FloraDocument,
    job: ImportJob,
    checkpoint: AnalysisCheckpoint,
  ): Promise<void> {
    const nextDeferCount = checkpoint.geminiDeferCount + 1;
    const maxDeferred = IMPORT_CONFIG.gemini.maxDeferredRetries;

    if (nextDeferCount > maxDeferred) {
      failImportPipeline(
        {
          step: "analysis",
          documentId: document.id,
          jobId: job.id,
          fileName: document.original_filename,
          extra: { geminiDeferCount: nextDeferCount },
        },
        new Error(
          "Les serveurs d'IA restent indisponibles. Réessayez l'analyse manuellement dans quelques minutes.",
        ),
      );
    }

    const retryMinutes = IMPORT_CONFIG.gemini.deferredRetryMinutes;
    const retryAfter = new Date(Date.now() + retryMinutes * 60_000).toISOString();
    const deferredCheckpoint: AnalysisCheckpoint = {
      ...checkpoint,
      geminiDeferCount: nextDeferCount,
    };

    await (await floraDb())
      .from("documents")
      .update({
        status: "uploaded",
        metadata: {
          ...(document.metadata ?? {}),
          analysisCheckpoint: deferredCheckpoint,
          geminiRetryAfter: retryAfter,
        },
      })
      .eq("id", document.id);

    await this.updateJob(job.id, {
      status: "waiting_ai",
      progress: 52,
      stageLabel: AI_QUEUE_USER_MESSAGE,
      errorMessage: "",
      metadata: {
        analysisCheckpoint: deferredCheckpoint,
        geminiRetryAfter: retryAfter,
      },
    });

    await notificationManager.notify({
      documentId: document.id,
      jobId: job.id,
      type: "analysis_deferred",
      message: AI_QUEUE_USER_MESSAGE,
    });

    console.info("[import] Analyse IA différée", {
      documentId: document.id,
      jobId: job.id,
      retryAfter,
      geminiDeferCount: nextDeferCount,
    });
  }

  private async updateJob(
    jobId: string,
    patch: {
      status?: ImportJob["status"];
      progress?: number;
      stageLabel?: string;
      completedAt?: string;
      errorMessage?: string;
      metadata?: JobMetadata;
    },
  ): Promise<void> {
    const updatePayload: Record<string, unknown> = {
      status: patch.status,
      progress: patch.progress,
      stage_label: patch.stageLabel,
      error_message: patch.errorMessage ?? "",
      completed_at: patch.completedAt ?? null,
      updated_at: new Date().toISOString(),
    };

    if (patch.metadata !== undefined) {
      updatePayload.metadata = patch.metadata;
    }

    await (await floraDb()).from("document_import_jobs").update(updatePayload).eq("id", jobId);
  }
}

export const documentAnalyzer = new DocumentAnalyzer();
