import { toErrorMessage } from "@/lib/api/route-diagnostics";
import { analyseBoSectionPart } from "./bo-section-analyser";
import {
  appendBoCompetences,
  clearBoCompetences,
  countBoCompetences,
  getBoDocumentById,
  markBoDocumentError,
  updateBoDocument,
} from "./bo-document-service";
import { inferBoMetadata, splitBoTextIntoSections, chunkSectionText } from "./bo-section-splitter";
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

function buildCheckpoint(sections: BoSectionChunk[]): BoAnalyzeCheckpoint {
  const partsTotal = sections.reduce(
    (sum, section) => sum + Math.max(1, chunkSectionText(section.text).length),
    0,
  );

  return {
    sectionIndex: 0,
    partIndex: 0,
    sectionBuffer: [],
    sectionsTotal: sections.length,
    partsTotal,
    partsCompleted: 0,
    sectionsCompleted: [],
    nextSortOrder: 1,
    startedAt: new Date().toISOString(),
  };
}

export function readBoAnalyzeProgress(document: {
  status: string;
  metadata?: Record<string, unknown> | null;
}): BoAnalyzeProgress | null {
  const checkpoint = readCheckpoint(document.metadata ?? undefined);
  if (!checkpoint) return null;

  const progress =
    checkpoint.partsTotal > 0
      ? Math.min(100, Math.round((checkpoint.partsCompleted / checkpoint.partsTotal) * 100))
      : 0;

  const currentSection = checkpoint.sectionsCompleted.at(-1) ?? null;
  const stageLabel =
    document.status === "ANALYZING"
      ? currentSection
        ? `Analyse en cours — ${currentSection}`
        : "Analyse Théa en cours…"
      : "Analyse terminée";

  return {
    done: document.status !== "ANALYZING",
    progress,
    stageLabel,
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

  const sections = splitBoTextIntoSections(existing.extracted_text);
  const checkpoint = buildCheckpoint(sections);

  await clearBoCompetences(documentId);
  await updateBoDocument(documentId, {
    status: "ANALYZING",
    error_message: "",
    metadata: {
      ...(existing.metadata ?? {}),
      analyzeCheckpoint: checkpoint,
      analyzeProgress: {
        progress: 0,
        stageLabel: "Analyse Théa démarrée…",
        sectionsTotal: checkpoint.sectionsTotal,
        partsTotal: checkpoint.partsTotal,
      },
      error_message: "",
    },
  });

  return {
    done: false,
    progress: 0,
    stageLabel: "Analyse Théa démarrée…",
    sectionsProcessed: [],
    sectionsTotal: checkpoint.sectionsTotal,
    partsCompleted: 0,
    partsTotal: checkpoint.partsTotal,
    insertedCount: 0,
    documentStatus: "ANALYZING",
  };
}

export async function runBoAnalyzeTick(documentId: string): Promise<BoAnalyzeProgress & BoImportResult | BoAnalyzeProgress> {
  const existing = await getBoDocumentById(documentId);
  if (!existing) {
    throw new Error("Document BO introuvable.");
  }

  if (!existing.extracted_text?.trim()) {
    throw new Error("Aucun texte extrait. Relancez l'extraction avant l'analyse.");
  }

  let checkpoint = readCheckpoint(existing.metadata ?? undefined);
  if (!checkpoint || existing.status !== "ANALYZING") {
    await startBoAnalyzeJob(documentId);
    const restarted = await getBoDocumentById(documentId);
    checkpoint = readCheckpoint(restarted?.metadata ?? undefined);
    if (!checkpoint) {
      throw new Error("Impossible d'initialiser l'analyse progressive.");
    }
  }

  const metadata = inferBoMetadata(existing.extracted_text);
  const sections = splitBoTextIntoSections(existing.extracted_text);
  const defaults = {
    cycle: existing.cycle || metadata.cycle,
    matiere: existing.matiere || metadata.matiere,
  };

  try {
    if (checkpoint.sectionIndex >= sections.length) {
      return finalizeBoAnalyzeJob(documentId, sections, defaults, checkpoint);
    }

    const section = sections[checkpoint.sectionIndex];
    const parts = chunkSectionText(section.text);
    const part = parts[checkpoint.partIndex];

    if (!part) {
      checkpoint.sectionIndex += 1;
      checkpoint.partIndex = 0;
      checkpoint.sectionBuffer = [];
      await persistCheckpoint(documentId, existing.metadata ?? {}, checkpoint, section.label);
      return progressFromCheckpoint(documentId, "ANALYZING", checkpoint, `Section terminée : ${section.label}`);
    }

    const partLabel = parts.length > 1 ? `${checkpoint.partIndex + 1}/${parts.length}` : undefined;

    console.info("[bo-analyser] Analyse bloc", {
      documentId,
      section: section.label,
      part: partLabel ?? "1/1",
      textLength: part.length,
    });

    const items = await analyseBoSectionPart({
      section,
      text: part,
      partLabel,
      defaults,
    });

    checkpoint.sectionBuffer.push(...items);
    checkpoint.partIndex += 1;
    checkpoint.partsCompleted += 1;

    const sectionDone = checkpoint.partIndex >= parts.length;
    let stageLabel = `Analyse : ${section.label}${partLabel ? ` (${partLabel})` : ""}`;

    if (sectionDone) {
      const inserted = await appendBoCompetences({
        documentId,
        competences: checkpoint.sectionBuffer,
        sortOrderStart: checkpoint.nextSortOrder,
      });
      checkpoint.nextSortOrder += inserted;
      checkpoint.sectionsCompleted.push(section.label);
      checkpoint.sectionBuffer = [];
      checkpoint.sectionIndex += 1;
      checkpoint.partIndex = 0;
      stageLabel = `Section enregistrée : ${section.label}`;

      console.info("[bo-analyser] Section enregistrée", {
        documentId,
        section: section.label,
        items: inserted,
      });
    }

    if (checkpoint.sectionIndex >= sections.length) {
      return finalizeBoAnalyzeJob(documentId, sections, defaults, checkpoint);
    }

    await persistCheckpoint(documentId, existing.metadata ?? {}, checkpoint, stageLabel);
    return progressFromCheckpoint(documentId, "ANALYZING", checkpoint, stageLabel);
  } catch (error) {
    const message = toErrorMessage(error);
    await markBoDocumentError(documentId, message, "TEXT_EXTRACTED");
    throw new Error(message);
  }
}

async function finalizeBoAnalyzeJob(
  documentId: string,
  sections: BoSectionChunk[],
  defaults: { cycle: string; matiere: string },
  checkpoint: BoAnalyzeCheckpoint,
): Promise<BoAnalyzeProgress & BoImportResult> {
  const existing = await getBoDocumentById(documentId);
  const insertedCount = await countBoCompetences(documentId);
  const validation = validateBoExtraction({
    competences: [],
    sections,
    matiere: defaults.matiere,
  });
  validation.totalCompetences = insertedCount;

  const document = await updateBoDocument(documentId, {
    status: "ANALYZED",
    validation,
    metadata: {
      ...(existing?.metadata ?? {}),
      analyzeCheckpoint: null,
      analyzeProgress: {
        progress: 100,
        stageLabel: "Analyse Théa terminée",
        sectionsTotal: checkpoint.sectionsTotal,
        partsTotal: checkpoint.partsTotal,
        partsCompleted: checkpoint.partsCompleted,
        sectionsCompleted: checkpoint.sectionsCompleted,
      },
      sectionsProcessed: checkpoint.sectionsCompleted,
      insertedCount,
      analyzedAt: new Date().toISOString(),
      savedToLibrary: false,
      error_message: "",
    },
  });

  return {
    done: true,
    progress: 100,
    stageLabel: "Analyse Théa terminée",
    sectionsProcessed: checkpoint.sectionsCompleted,
    sectionsTotal: checkpoint.sectionsTotal,
    partsCompleted: checkpoint.partsCompleted,
    partsTotal: checkpoint.partsTotal,
    insertedCount,
    documentStatus: document.status,
    document,
    competences: [],
    validation,
    savedToLibrary: false,
  };
}

async function persistCheckpoint(
  documentId: string,
  metadata: Record<string, unknown>,
  checkpoint: BoAnalyzeCheckpoint,
  stageLabel: string,
) {
  const progress =
    checkpoint.partsTotal > 0
      ? Math.min(100, Math.round((checkpoint.partsCompleted / checkpoint.partsTotal) * 100))
      : 0;

  await updateBoDocument(documentId, {
    status: "ANALYZING",
    metadata: {
      ...metadata,
      analyzeCheckpoint: checkpoint,
      analyzeProgress: {
        progress,
        stageLabel,
        sectionsTotal: checkpoint.sectionsTotal,
        partsTotal: checkpoint.partsTotal,
        partsCompleted: checkpoint.partsCompleted,
        sectionsCompleted: checkpoint.sectionsCompleted,
      },
    },
  });
}

function progressFromCheckpoint(
  documentId: string,
  status: string,
  checkpoint: BoAnalyzeCheckpoint,
  stageLabel: string,
): BoAnalyzeProgress {
  const progress =
    checkpoint.partsTotal > 0
      ? Math.min(100, Math.round((checkpoint.partsCompleted / checkpoint.partsTotal) * 100))
      : 0;

  return {
    done: false,
    progress,
    stageLabel,
    sectionsProcessed: checkpoint.sectionsCompleted,
    sectionsTotal: checkpoint.sectionsTotal,
    partsCompleted: checkpoint.partsCompleted,
    partsTotal: checkpoint.partsTotal,
    insertedCount: checkpoint.nextSortOrder - 1,
    documentStatus: status,
  };
}

/** Boucle locale (tests CLI) — une requête HTTP = un tick côté API. */
export async function runBoAnalyzeStepProgressive(documentId: string): Promise<BoImportResult> {
  let latest: (BoAnalyzeProgress & Partial<BoImportResult>) | null = null;

  for (let guard = 0; guard < 500; guard += 1) {
    latest = await runBoAnalyzeTick(documentId);
    if (latest.done && "document" in latest && latest.document) {
      return latest as BoImportResult;
    }
  }

  throw new Error("Analyse progressive interrompue (limite de ticks).");
}
