import type { Dispatch, SetStateAction } from "react";
import type { ImportProgressStage, UploadProgress } from "@/lib/documents/import/types";
import { formatBytes } from "@/lib/documents/import/config";
import { GEMINI_QUEUE_USER_MESSAGE } from "@/lib/thea/messages";
import type { UploadPhase } from "../types";
import {
  formatUploadEta,
  formatUploadProgressLine,
  IMPORT_POLL_INTERVAL_MS,
  kickoffDocumentAnalysis,
  pollImportStatus,
  resolveDuplicateImport,
  uploadDocumentWithChunks,
  type ChunkUploadResultPayload,
} from "./chunk-upload-client";

export type FileImportItem = {
  id: string;
  fileName: string;
  fileSize: number;
  phase: UploadPhase;
  stage: ImportProgressStage;
  progress: number;
  statusLabel: string;
  detailLine: string;
  speedLine: string | null;
  etaLine: string | null;
  message: string | null;
  error: string | null;
  documentId?: string;
  jobId?: string;
  sessionId?: string;
  duplicateDetected?: boolean;
};

export type MultiUploadState = {
  items: FileImportItem[];
  globalMessage: string | null;
  globalError: string | null;
};

export const initialMultiUploadState: MultiUploadState = {
  items: [],
  globalMessage: null,
  globalError: null,
};

function createItem(file: File): FileImportItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    fileSize: file.size,
    phase: "uploading",
    stage: "preparation",
    progress: 0,
    statusLabel: "Préparation de l'import…",
    detailLine: "",
    speedLine: null,
    etaLine: null,
    message: null,
    error: null,
  };
}

function formatSpeedLine(progress: UploadProgress): string | null {
  if (progress.speedBytesPerSecond <= 0) return null;
  return `Vitesse : ${formatBytes(progress.speedBytesPerSecond)}/s`;
}

function progressToItem(item: FileImportItem, progress: UploadProgress): FileImportItem {
  return {
    ...item,
    phase: progress.stage === "completed" ? "success" : item.phase === "analyzing" ? "analyzing" : "uploading",
    stage: progress.stage,
    progress: progress.percent,
    statusLabel: progress.label,
    detailLine: formatUploadProgressLine(progress),
    speedLine: formatSpeedLine(progress),
    etaLine: formatUploadEta(progress),
  };
}

function mapJobStatusToStage(status: string): ImportProgressStage {
  switch (status) {
    case "extracting":
    case "ocr":
    case "analyzing":
    case "waiting_ai":
      return "analysis";
    case "indexing":
      return "indexing";
    case "completed":
      return "completed";
    default:
      return "analysis";
  }
}

function patchItem(
  setUploadState: Dispatch<SetStateAction<MultiUploadState>>,
  itemId: string,
  patch: Partial<FileImportItem> | ((item: FileImportItem) => FileImportItem),
) {
  setUploadState((current) => ({
    ...current,
    items: current.items.map((entry) => {
      if (entry.id !== itemId) return entry;
      return typeof patch === "function" ? patch(entry) : { ...entry, ...patch };
    }),
  }));
}

async function pollAnalysisUntilDone(
  item: FileImportItem,
  setUploadState: Dispatch<SetStateAction<MultiUploadState>>,
): Promise<void> {
  if (!item.documentId) return;

  patchItem(setUploadState, item.id, {
    phase: "analyzing",
    stage: "analysis",
    progress: Math.max(item.progress, 60),
    statusLabel: "Analyse pédagogique en cours…",
    detailLine: "Extraction, OCR, titres, chapitres et métadonnées.",
  });

  void kickoffDocumentAnalysis(item.documentId, item.jobId).catch((error) => {
    const message = error instanceof Error ? error.message : "Analyse impossible.";
    patchItem(setUploadState, item.id, {
      phase: "error",
      stage: "analysis",
      error: message,
      statusLabel: "Échec de l'analyse",
    });
  });

  let keepPolling = true;
  let unchangedPolls = 0;
  let lastProgress = -1;

  while (keepPolling) {
    await new Promise((resolve) => setTimeout(resolve, IMPORT_POLL_INTERVAL_MS));

    try {
      const status = await pollImportStatus(item.documentId, item.jobId);
      const job = status.job;
      if (!job) continue;

      if (job.status === "waiting_ai") {
        patchItem(setUploadState, item.id, {
          phase: "analyzing",
          stage: "analysis",
          progress: Math.max(52, Math.min(58, job.progress)),
          statusLabel: "En file d'attente IA",
          detailLine: job.stageLabel || GEMINI_QUEUE_USER_MESSAGE,
          message: job.stageLabel || GEMINI_QUEUE_USER_MESSAGE,
          speedLine: null,
          etaLine: null,
        });
        continue;
      }

      if (job.status === "completed") {
        patchItem(setUploadState, item.id, {
          phase: "success",
          stage: "completed",
          progress: 100,
          statusLabel: "Document disponible",
          detailLine: `${formatBytes(item.fileSize)} indexé dans votre bibliothèque.`,
          speedLine: null,
          etaLine: null,
          message: job.stageLabel || "Analyse terminée.",
        });
        keepPolling = false;
        break;
      }

      if (job.status === "failed" || job.status === "cancelled") {
        patchItem(setUploadState, item.id, {
          phase: "error",
          stage: mapJobStatusToStage(job.status),
          progress: job.progress,
          statusLabel: "Échec de l'analyse",
          error: job.errorMessage || "Analyse impossible.",
        });
        keepPolling = false;
        break;
      }

      const stage = mapJobStatusToStage(job.status);
      const progress = Math.max(stage === "indexing" ? 85 : 60, Math.min(99, job.progress));

      if (progress === lastProgress) {
        unchangedPolls += 1;
      } else {
        unchangedPolls = 0;
        lastProgress = progress;
      }

      if (
        unchangedPolls >= 30 &&
        ["extracting", "analyzing", "indexing"].includes(job.status)
      ) {
        void kickoffDocumentAnalysis(item.documentId, item.jobId).catch(() => undefined);
        unchangedPolls = 0;
      }

      patchItem(setUploadState, item.id, {
        phase: "analyzing",
        stage,
        progress,
        statusLabel: job.stageLabel || "Analyse en cours…",
        detailLine:
          stage === "indexing"
            ? "Découpage, segments et indexation pédagogique…"
            : "Analyse IA : pages, OCR, matières, niveau, cycle…",
      });
    } catch {
      // Polling silencieux en cas de perte réseau temporaire.
    }
  }
}

export async function importFilesWithProgress(
  files: File[],
  setUploadState: Dispatch<SetStateAction<MultiUploadState>>,
): Promise<void> {
  for (const file of files) {
    const item = createItem(file);

    setUploadState((current) => ({
      items: [item, ...current.items],
      globalMessage: null,
      globalError: null,
    }));

    try {
      let working = item;

      const result: ChunkUploadResultPayload = await uploadDocumentWithChunks(file, (progress) => {
        working = progressToItem(working, progress);
        patchItem(setUploadState, working.id, working);
      });

      if (result.duplicateDetected && result.sessionId) {
        patchItem(setUploadState, working.id, {
          phase: "warning",
          stage: "verification",
          progress: 100,
          statusLabel: "Doublon détecté — conservation des deux versions",
          sessionId: result.sessionId,
          duplicateDetected: true,
        });

        const resolved = await resolveDuplicateImport({
          sessionId: result.sessionId,
          resolution: "keep_both",
        });

        working = {
          ...working,
          documentId: resolved.documentId,
          jobId: resolved.jobId,
          message: resolved.message ?? null,
          phase: "analyzing",
          stage: "analysis",
          progress: 100,
          statusLabel: "Upload terminé",
          detailLine: "Analyse du document en cours…",
          etaLine: null,
          speedLine: null,
        };
      } else {
        working = {
          ...working,
          documentId: result.documentId,
          jobId: result.jobId,
          message: result.message ?? null,
          phase: "analyzing",
          stage: "analysis",
          progress: 100,
          statusLabel: "Upload terminé",
          detailLine: "Analyse du document en cours…",
          etaLine: null,
          speedLine: null,
        };
      }

      patchItem(setUploadState, working.id, working);
      setUploadState((current) => ({
        ...current,
        globalMessage: working.message,
      }));

      void pollAnalysisUntilDone(working, setUploadState);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import impossible.";
      patchItem(setUploadState, item.id, {
        phase: "error",
        stage: "upload",
        error: message,
        statusLabel: "Échec de l'import",
      });
      setUploadState((current) => ({
        ...current,
        globalError: message,
      }));
    }
  }
}
