import { toErrorMessage } from "@/lib/api/route-diagnostics";
import {
  extractBoFaithfully,
  mapFaithfulResultToDrafts,
} from "./bo-faithful/extract-faithful";
import {
  appendBoCompetences,
  clearBoCompetences,
  countBoCompetences,
  getBoDocumentById,
  markBoDocumentError,
  updateBoDocument,
} from "./bo-document-service";
import { inferBoMetadata, splitBoTextIntoSections } from "./bo-section-splitter";
import type { BoCompetenceDraft, BoImportResult, BoSectionChunk } from "./bo-types";
import { validateBoExtraction } from "./bo-validator";

export type BoAnalyzeCheckpoint = {
  sectionIndex: number;
  partIndex: number;
  sectionBuffer: BoCompetenceDraft[];
  sectionsTotal: number;
  partsTotal: number;
  partsCompleted: number;
  sectionsCompleted: string[];
  nextSortOrder: number;
  startedAt: string;
};

export type BoAnalyzeProgress = {
  done: boolean;
  progress: number;
  stageLabel: string;
  sectionsProcessed: string[];
  sectionsTotal: number;
  partsCompleted: number;
  partsTotal: number;
  insertedCount: number;
  documentStatus: string;
};

function readCheckpoint(metadata: Record<string, unknown> | null | undefined): BoAnalyzeCheckpoint | null {
  const raw = metadata?.analyzeCheckpoint;
  if (!raw || typeof raw !== "object") return null;
  return raw as BoAnalyzeCheckpoint;
}

export function readBoAnalyzeProgress(document: {
  status: string;
  metadata?: Record<string, unknown> | null;
}): BoAnalyzeProgress | null {
  const checkpoint = readCheckpoint(document.metadata ?? undefined);
  const analyzeProgress = document.metadata?.analyzeProgress;
  if (analyzeProgress && typeof analyzeProgress === "object") {
    const progress = analyzeProgress as Record<string, unknown>;
    return {
      done: document.status !== "ANALYZING",
      progress: typeof progress.progress === "number" ? progress.progress : 0,
      stageLabel: typeof progress.stageLabel === "string" ? progress.stageLabel : "Analyse BO",
      sectionsProcessed: Array.isArray(progress.sectionsCompleted)
        ? (progress.sectionsCompleted as string[])
        : [],
      sectionsTotal: typeof progress.sectionsTotal === "number" ? progress.sectionsTotal : 1,
      partsCompleted: typeof progress.partsCompleted === "number" ? progress.partsCompleted : 0,
      partsTotal: typeof progress.partsTotal === "number" ? progress.partsTotal : 1,
      insertedCount: typeof progress.insertedCount === "number" ? progress.insertedCount : 0,
      documentStatus: document.status,
    };
  }

  if (!checkpoint) return null;

  const progress =
    checkpoint.partsTotal > 0
      ? Math.min(100, Math.round((checkpoint.partsCompleted / checkpoint.partsTotal) * 100))
      : 0;

  return {
    done: document.status !== "ANALYZING",
    progress,
    stageLabel: document.status === "ANALYZING" ? "Analyse BO en cours…" : "Analyse terminée",
    sectionsProcessed: checkpoint.sectionsCompleted,
    sectionsTotal: checkpoint.sectionsTotal,
    partsCompleted: checkpoint.partsCompleted,
    partsTotal: checkpoint.partsTotal,
    insertedCount: checkpoint.nextSortOrder - 1,
    documentStatus: document.status,
  };
}

export async function startBoAnalyzeJob(documentId: string): Promise<BoAnalyzeProgress> {
  const existing = await getBoDocumentById(documentId);
  if (!existing) {
    throw new Error("Document BO introuvable.");
  }

  if (!existing.extracted_text?.trim()) {
    throw new Error("Aucun texte extrait. Relancez l'extraction avant l'analyse.");
  }

  await clearBoCompetences(documentId);
  await updateBoDocument(documentId, {
    status: "ANALYZING",
    error_message: "",
    metadata: {
      ...(existing.metadata ?? {}),
      analyzeCheckpoint: null,
      analyzeProgress: {
        progress: 0,
        stageLabel: "Analyse fidèle du BO démarrée…",
        sectionsTotal: 1,
        partsTotal: 1,
        partsCompleted: 0,
        sectionsCompleted: [],
        insertedCount: 0,
      },
      error_message: "",
    },
  });

  return {
    done: false,
    progress: 0,
    stageLabel: "Analyse fidèle du BO démarrée…",
    sectionsProcessed: [],
    sectionsTotal: 1,
    partsCompleted: 0,
    partsTotal: 1,
    insertedCount: 0,
    documentStatus: "ANALYZING",
  };
}

async function finalizeBoAnalyzeJob(
  documentId: string,
  sections: BoSectionChunk[],
  defaults: { cycle: string; matiere: string },
  competences: BoCompetenceDraft[],
  faithfulMetadata: Record<string, unknown>,
): Promise<BoAnalyzeProgress & BoImportResult> {
  const validation = validateBoExtraction({
    competences,
    sections,
    matiere: defaults.matiere,
    qualityReport: faithfulMetadata.qualityReport as Record<string, unknown> | undefined,
  });
  validation.totalCompetences = competences.length;

  const existing = await getBoDocumentById(documentId);
  const document = await updateBoDocument(documentId, {
    status: "ANALYZED",
    validation,
    metadata: {
      ...(existing?.metadata ?? {}),
      ...faithfulMetadata,
      analyzeCheckpoint: null,
      analyzeProgress: {
        progress: 100,
        stageLabel: "Analyse fidèle terminée",
        sectionsTotal: 1,
        partsTotal: 1,
        partsCompleted: 1,
        sectionsCompleted: Object.keys(
          (faithfulMetadata.qualityReport as { competencesBySousMatiere?: Record<string, number> })
            ?.competencesBySousMatiere ?? {},
        ),
        insertedCount: competences.length,
      },
      sectionsProcessed: sections.map((section) => section.label),
      insertedCount: competences.length,
      competencesToReview: faithfulMetadata.competencesToReview ?? [],
      reviewQueueCount: Array.isArray(faithfulMetadata.competencesToReview)
        ? faithfulMetadata.competencesToReview.length
        : 0,
      analyzedAt: new Date().toISOString(),
      savedToLibrary: false,
      error_message: "",
    },
  });

  return {
    done: true,
    progress: 100,
    stageLabel: "Analyse fidèle terminée",
    sectionsProcessed: sections.map((section) => section.label),
    sectionsTotal: 1,
    partsCompleted: 1,
    partsTotal: 1,
    insertedCount: competences.length,
    documentStatus: document.status,
    document,
    competences,
    validation,
    savedToLibrary: false,
  };
}

export async function runBoAnalyzeTick(
  documentId: string,
): Promise<BoAnalyzeProgress & BoImportResult | BoAnalyzeProgress> {
  const existing = await getBoDocumentById(documentId);
  if (!existing) {
    throw new Error("Document BO introuvable.");
  }

  if (!existing.extracted_text?.trim()) {
    throw new Error("Aucun texte extrait. Relancez l'extraction avant l'analyse.");
  }

  if (existing.status !== "ANALYZING") {
    await startBoAnalyzeJob(documentId);
  }

  const metadata = inferBoMetadata(existing.extracted_text);
  const defaults = {
    cycle: existing.cycle || metadata.cycle,
    matiere: existing.matiere || metadata.matiere,
  };
  const sections = splitBoTextIntoSections(existing.extracted_text);

  try {
    const faithful = extractBoFaithfully({
      text: existing.extracted_text,
      cycle: defaults.cycle,
      matiere: defaults.matiere,
      domaine: existing.domaine ?? undefined,
      documentNiveaux: existing.niveau ?? undefined,
    });
    const { confirmed: competences, toReview } = mapFaithfulResultToDrafts(faithful, defaults);

    await clearBoCompetences(documentId);
    const insertedCount = await appendBoCompetences({
      documentId,
      competences,
      sortOrderStart: 1,
    });

    if (insertedCount === 0) {
      throw new Error("Aucune compétence extraite du BO. Vérifiez le format du document.");
    }

    return finalizeBoAnalyzeJob(documentId, sections, defaults, competences, {
      introduction: faithful.introduction,
      introductionCharCount: faithful.quality.introductionCharCount,
      extractionMethod: faithful.extractionMethod,
      qualityReport: faithful.quality,
      competencesToReview: toReview,
      faithfulAnalysis: {
        tablesDetected: faithful.quality.tablesDetected,
        tablesProcessed: faithful.quality.tablesProcessed,
        competencesByMatiere: faithful.quality.competencesByMatiere,
        competencesBySousMatiere: faithful.quality.competencesBySousMatiere,
        competencesBySousSousMatiere: faithful.quality.competencesBySousSousMatiere,
        competencesByNiveau: faithful.quality.competencesByNiveau,
        competencesToReview: faithful.quality.competencesToReview,
        warnings: faithful.quality.warnings,
        passed: faithful.quality.passed,
      },
    });
  } catch (error) {
    const message = toErrorMessage(error);
    await markBoDocumentError(documentId, message, "TEXT_EXTRACTED");
    throw new Error(message);
  }
}

/** Boucle locale (tests CLI) — une requête HTTP = un tick côté API. */
export async function runBoAnalyzeStepProgressive(documentId: string): Promise<BoImportResult> {
  const latest = await runBoAnalyzeTick(documentId);
  if (latest.done && "document" in latest && latest.document) {
    return latest as BoImportResult;
  }

  throw new Error("Analyse fidèle interrompue.");
}
