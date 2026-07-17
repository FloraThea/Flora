"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { getModuleAcceptAttribute, isSupportedImageFile } from "@/lib/import/accepted-formats";
import { formatBatchLimitsLabel, PROGRAMMATION_IMPORT_BATCH_LIMITS } from "@/lib/programming/import/batch-limits";
import {
  findDuplicateFiles,
  validateBatchFiles,
} from "@/lib/programming/import/batch-validation";
import type { ImportBatchMergeMode, ImportedFileStatus } from "@/lib/programming/import/batch-types";
import { resolveImportFileName } from "@/lib/import/accepted-formats";
import {
  ImportFileRegistry,
  fetchImportWithTimeout,
  mapImportFailureMessage,
  parseImportApiError,
  readImportApiResponse,
  uploadBatchFile,
  type ImportWorkflowStep,
} from "@/lib/programming/import/import-batch-client";
import {
  buildMinimalParsedFromUpload,
  mergeParsedProgrammationImports,
} from "@/lib/programming/import/build-minimal-parsed-import";
import type { ParsedProgrammationImport } from "@/lib/programming/import/types";

const ANALYZE_PAGE_TIMEOUT_MS = 120_000;

export type BatchPanelFile = {
  clientId: string;
  filename: string;
  mimeType: string;
  pageOrder: number;
  pdfPageNumber?: number;
  previewUrl?: string;
  status: ImportedFileStatus;
  error?: string;
  fileId?: string;
  storagePath?: string;
};

type Props = {
  schoolYear: string;
  onAnalyzed: (parsed: ParsedProgrammationImport, batchId: string, storagePaths: string[]) => void;
  onError: (message: string | null) => void;
};

const STATUS_LABELS: Record<ImportedFileStatus, string> = {
  pending: "En attente",
  uploading: "Téléversement",
  uploaded: "Téléversé",
  analyzing: "Analyse en cours",
  analyzed: "Analysé",
  error: "Erreur",
  skipped: "Ignoré",
};

function createClientId(): string {
  return `client-${Math.random().toString(36).slice(2, 10)}`;
}

function createBatchId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `batch-${Math.random().toString(36).slice(2, 10)}`;
}

function shouldFallbackToInlineAnalyze(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("accessible") ||
    normalized.includes("stockage") ||
    normalized.includes("storage") ||
    normalized.includes("introuvable") ||
    normalized.includes("download") ||
    normalized.includes("nosuchkey") ||
    normalized.includes("fichier local introuvable")
  );
}

function buildPreviewUrl(file: File): string | undefined {
  if (isSupportedImageFile(file.name, file.type)) {
    return URL.createObjectURL(file);
  }
  return undefined;
}

export function ProgrammationImportBatchPanel({ schoolYear, onAnalyzed, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const fileRegistry = useRef(new ImportFileRegistry());
  const [batchId, setBatchId] = useState<string>(() => createBatchId());
  const [files, setFiles] = useState<BatchPanelFile[]>([]);
  const [mergeMode, setMergeMode] = useState<ImportBatchMergeMode>("single_document");
  const [uiState, setUiState] = useState<ImportWorkflowStep>("idle");
  const [failureStep, setFailureStep] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<string[] | null>(null);
  const [pendingAddFiles, setPendingAddFiles] = useState<File[]>([]);
  const [analyzeProgress, setAnalyzeProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastUploadedBatch, setLastUploadedBatch] = useState<{
    batchId: string;
    pages: Array<{
      fileId: string;
      clientId: string;
      filename: string;
      mimeType: string;
      pageOrder: number;
      storagePath: string;
      pdfPageNumber?: number;
    }>;
  } | null>(null);

  const accept = getModuleAcceptAttribute("programmation");
  const isBusy = uiState === "uploading" || uiState === "analyzing" || uiState === "saving";

  useEffect(() => {
    return () => {
      for (const item of files) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [files]);

  const sortedFiles = useMemo(
    () => [...files].sort((a, b) => a.pageOrder - b.pageOrder),
    [files],
  );

  const reorderFiles = useCallback((next: BatchPanelFile[]) => {
    setFiles(
      next.map((item, index) => ({
        ...item,
        pageOrder: index + 1,
      })),
    );
  }, []);

  const ensureBatch = useCallback(async (): Promise<string> => {
    console.log("[ProgrammingImport] batch-create-start");
    const response = await fetch("/api/programmation/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "batch_create",
        batchId,
        schoolYear,
        mergeMode,
      }),
    });
    const data = await readImportApiResponse<{
      batchId?: string;
      error?: string;
      details?: string;
    }>(response, "Impossible de créer le lot d'import.");
    if (!response.ok) {
      throw new Error(parseImportApiError(data, "Impossible de créer le lot d'import."));
    }
    const resolvedBatchId = data.batchId ?? batchId;
    setBatchId(resolvedBatchId);
    console.log("[ProgrammingImport] batch-created", resolvedBatchId);
    return resolvedBatchId;
  }, [batchId, mergeMode, schoolYear]);

  const registerIncomingFiles = useCallback((incoming: File[]) => {
    console.log("[ProgrammingImport] files-selected", {
      count: incoming.length,
      names: incoming.map((file) => file.name),
      types: incoming.map((file) => file.type),
      sizes: incoming.map((file) => file.size),
      registrySize: fileRegistry.current.count(),
    });

    const registryFiles = sortedFiles
      .map((item) => fileRegistry.current.get(item.clientId))
      .filter(Boolean) as File[];

    const validation = validateBatchFiles([...registryFiles, ...incoming]);
    if (!validation.ok) {
      setUiState("error");
      setFailureStep("validation");
      onError(validation.error);
      return;
    }

    const duplicates = findDuplicateFiles(registryFiles, incoming);
    if (duplicates.length > 0) {
      setDuplicatePrompt(duplicates);
      setPendingAddFiles(incoming);
      return;
    }

    const startOrder = files.length + 1;
    const nextItems: BatchPanelFile[] = incoming.map((file, index) => {
      const clientId = createClientId();
      fileRegistry.current.set(clientId, file);
      return {
        clientId,
        filename: file.name,
        mimeType: file.type,
        pageOrder: startOrder + index,
        previewUrl: buildPreviewUrl(file),
        status: "pending",
      };
    });

    setFiles((current) => [...current, ...nextItems]);
    setUiState("files_selected");
    onError(null);
  }, [files.length, onError, sortedFiles]);

  const confirmDuplicateAdd = useCallback(() => {
    if (pendingAddFiles.length === 0) return;
    const startOrder = files.length + 1;
    const nextItems: BatchPanelFile[] = pendingAddFiles.map((file, index) => {
      const clientId = createClientId();
      fileRegistry.current.set(clientId, file);
      return {
        clientId,
        filename: file.name,
        mimeType: file.type,
        pageOrder: startOrder + index,
        previewUrl: buildPreviewUrl(file),
        status: "pending",
      };
    });
    setFiles((current) => [...current, ...nextItems]);
    setPendingAddFiles([]);
    setDuplicatePrompt(null);
    setUiState("files_selected");
    onError(null);
  }, [files.length, onError, pendingAddFiles]);

  const moveFile = useCallback(
    (clientId: string, direction: -1 | 1 | "first" | "last") => {
      const index = sortedFiles.findIndex((item) => item.clientId === clientId);
      if (index < 0) return;
      const next = [...sortedFiles];
      const [item] = next.splice(index, 1);
      if (direction === "first") next.unshift(item);
      else if (direction === "last") next.push(item);
      else next.splice(Math.max(0, Math.min(next.length, index + direction)), 0, item);
      reorderFiles(next);
    },
    [reorderFiles, sortedFiles],
  );

  const removeFile = useCallback((clientId: string) => {
    setFiles((current) => {
      const target = current.find((item) => item.clientId === clientId);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      fileRegistry.current.delete(clientId);
      const filtered = current.filter((item) => item.clientId !== clientId);
      return filtered.map((item, index) => ({ ...item, pageOrder: index + 1 }));
    });
  }, []);

  const replaceFile = useCallback((clientId: string, replacement: File) => {
    fileRegistry.current.set(clientId, replacement);
    setFiles((current) =>
      current.map((item) => {
        if (item.clientId !== clientId) return item;
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return {
          ...item,
          filename: replacement.name,
          mimeType: replacement.type,
          previewUrl: buildPreviewUrl(replacement),
          status: "pending",
          error: undefined,
          fileId: undefined,
          storagePath: undefined,
        };
      }),
    );
    setUiState("files_selected");
    onError(null);
  }, [onError]);

  const runAnalyzeInline = useCallback(
    async (input: {
      currentBatchId: string;
      pages: Array<{
        fileId: string;
        clientId: string;
        filename: string;
        mimeType: string;
        pageOrder: number;
        storagePath: string;
        pdfPageNumber?: number;
      }>;
    }) => {
      console.log("[ProgrammingImport] analyze-payload", {
        batchId: input.currentBatchId,
        documentMode: mergeMode,
        source: "inline",
        files: input.pages.map((file) => ({
          id: file.fileId,
          name: file.filename,
          mimeType: file.mimeType,
          storagePath: file.storagePath,
          hasAccessibleUrl: Boolean(file.storagePath),
          pageOrder: file.pageOrder,
        })),
      });

      const analyzeForm = new FormData();
      analyzeForm.append("action", "batch_analyze_inline");
      analyzeForm.append("batchId", input.currentBatchId);
      analyzeForm.append("mergeMode", mergeMode);
      analyzeForm.append(
        "pagesMetadata",
        JSON.stringify(
          input.pages.map((descriptor) => ({
            fileId: descriptor.fileId,
            pageOrder: descriptor.pageOrder,
            filename: descriptor.filename,
            mimeType: descriptor.mimeType,
            storagePath: descriptor.storagePath,
            pdfPageNumber: descriptor.pdfPageNumber,
          })),
        ),
      );

      for (const descriptor of input.pages) {
        const matchedFile = fileRegistry.current.get(descriptor.clientId);
        if (!matchedFile) {
          throw new Error(
            `La page ${descriptor.pageOrder} n'a pas pu être lue : fichier local introuvable. Réessayez l'analyse.`,
          );
        }
        analyzeForm.append(`file_${descriptor.fileId}`, matchedFile);
      }

      const analyzeResponse = await fetchImportWithTimeout(
        "/api/programmation/import",
        { method: "POST", body: analyzeForm },
        ANALYZE_PAGE_TIMEOUT_MS * Math.max(1, input.pages.length),
        "L'analyse a dépassé le délai autorisé. Vous pouvez continuer avec les fichiers téléversés ou réessayer.",
      );

      const analyzeData = await readImportApiResponse<{
        parsed?: ParsedProgrammationImport;
        files?: Array<{ fileId: string; status: ImportedFileStatus; error?: string }>;
        error?: string;
        details?: string;
      }>(analyzeResponse, "L'analyse des pages a échoué.");

      if (!analyzeResponse.ok || !analyzeData.parsed) {
        throw new Error(parseImportApiError(analyzeData, "L'analyse des pages a échoué."));
      }

      return {
        parsed: analyzeData.parsed,
        storagePaths: input.pages.map((entry) => entry.storagePath),
        fileStatuses: analyzeData.files ?? [],
      };
    },
    [mergeMode],
  );

  const runAnalyzeFromStorage = useCallback(
    async (input: {
      currentBatchId: string;
      pages: Array<{
        fileId: string;
        filename: string;
        mimeType: string;
        pageOrder: number;
        storagePath: string;
        pdfPageNumber?: number;
      }>;
    }) => {
      console.log("[ProgrammingImport] analyze-payload", {
        batchId: input.currentBatchId,
        documentMode: mergeMode,
        source: "storage",
        files: input.pages.map((file) => ({
          id: file.fileId,
          name: file.filename,
          mimeType: file.mimeType,
          storagePath: file.storagePath,
          hasAccessibleUrl: Boolean(file.storagePath),
          pageOrder: file.pageOrder,
        })),
      });

      const analyzeResponse = await fetchImportWithTimeout(
        "/api/programmation/import",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "batch_analyze",
            batchId: input.currentBatchId,
            mergeMode,
            uploadedFiles: input.pages,
          }),
        },
        ANALYZE_PAGE_TIMEOUT_MS * Math.max(1, input.pages.length),
        "L'analyse a dépassé le délai autorisé. Vous pouvez continuer avec les fichiers téléversés ou réessayer.",
      );

      const analyzeData = await readImportApiResponse<{
        parsed?: ParsedProgrammationImport;
        files?: Array<{ fileId: string; status: ImportedFileStatus; error?: string }>;
        error?: string;
        details?: string;
      }>(analyzeResponse, "L'analyse des pages a échoué.");

      if (!analyzeResponse.ok || !analyzeData.parsed) {
        throw new Error(parseImportApiError(analyzeData, "L'analyse des pages a échoué."));
      }

      return {
        parsed: analyzeData.parsed,
        storagePaths: input.pages.map((entry) => entry.storagePath),
        fileStatuses: analyzeData.files ?? [],
      };
    },
    [mergeMode],
  );

  const runAnalyzeWithFallback = useCallback(
    async (input: {
      currentBatchId: string;
      pages: Array<{
        fileId: string;
        clientId: string;
        filename: string;
        mimeType: string;
        pageOrder: number;
        storagePath: string;
        pdfPageNumber?: number;
      }>;
      onPageStart?: (pageOrder: number, total: number) => void;
      onPageComplete?: (page: {
        fileId: string;
        status: ImportedFileStatus;
        error?: string;
      }) => void;
    }) => {
      const activePages = input.pages.filter((page) => page.fileId && page.storagePath);
      if (activePages.length === 0) {
        throw new Error("Aucune page téléversée disponible pour l'analyse.");
      }

      let mergedParsed: ParsedProgrammationImport | null = null;
      const allStatuses: Array<{ fileId: string; status: ImportedFileStatus; error?: string }> = [];

      for (let index = 0; index < activePages.length; index += 1) {
        const page = activePages[index];
        input.onPageStart?.(index + 1, activePages.length);

        setFiles((current) =>
          current.map((entry) =>
            entry.fileId === page.fileId
              ? { ...entry, status: "analyzing" as ImportedFileStatus, error: undefined }
              : entry,
          ),
        );

        try {
          console.log("[ProgrammingImport] analyze-start", {
            batchId: input.currentBatchId,
            pageOrder: page.pageOrder,
            mode: "storage",
          });

          const result = await runAnalyzeFromStorage({
            currentBatchId: input.currentBatchId,
            pages: [page],
          });

          mergedParsed = mergedParsed
            ? mergeParsedProgrammationImports(mergedParsed, result.parsed)
            : result.parsed;

          for (const remote of result.fileStatuses) {
            allStatuses.push(remote);
            input.onPageComplete?.(remote);
          }
        } catch (storageError) {
          const message = storageError instanceof Error ? storageError.message : "";
          const canUseLocalFiles = fileRegistry.current.has(page.clientId);

          if (canUseLocalFiles && shouldFallbackToInlineAnalyze(message)) {
            console.warn("[ProgrammingImport] analyze-storage-fallback", {
              batchId: input.currentBatchId,
              pageOrder: page.pageOrder,
              reason: message,
            });

            try {
              const inlineResult = await runAnalyzeInline({
                currentBatchId: input.currentBatchId,
                pages: [page],
              });

              mergedParsed = mergedParsed
                ? mergeParsedProgrammationImports(mergedParsed, inlineResult.parsed)
                : inlineResult.parsed;

              for (const remote of inlineResult.fileStatuses) {
                allStatuses.push(remote);
                input.onPageComplete?.(remote);
              }
              continue;
            } catch (inlineError) {
              const inlineMessage =
                inlineError instanceof Error ? inlineError.message : "Analyse impossible.";
              allStatuses.push({ fileId: page.fileId, status: "error", error: inlineMessage });
              input.onPageComplete?.({ fileId: page.fileId, status: "error", error: inlineMessage });
              continue;
            }
          }

          allStatuses.push({ fileId: page.fileId, status: "error", error: message || "Analyse impossible." });
          input.onPageComplete?.({
            fileId: page.fileId,
            status: "error",
            error: message || "Analyse impossible.",
          });
        }
      }

      const storagePaths = activePages.map((entry) => entry.storagePath);
      const parsed =
        mergedParsed ??
        buildMinimalParsedFromUpload({
          batchId: input.currentBatchId,
          mergeMode,
          pages: activePages,
          warning:
            "Aucune page n'a pu être analysée automatiquement. Les fichiers restent téléversés — vous pouvez réessayer ou continuer.",
        });

      return {
        parsed,
        storagePaths,
        fileStatuses: allStatuses,
      };
    },
    [mergeMode, runAnalyzeFromStorage, runAnalyzeInline],
  );

  const runBatchImport = useCallback(async () => {
    const itemsWithFiles = sortedFiles.filter((item) => fileRegistry.current.has(item.clientId));
    if (itemsWithFiles.length === 0) {
      setUiState("error");
      setFailureStep("validation");
      onError("Ajoutez au moins un fichier.");
      return;
    }

    console.log("[ProgrammingImport] import-start", {
      fileCount: itemsWithFiles.length,
      registryCount: fileRegistry.current.count(),
    });

    setUiState("uploading");
    setFailureStep(null);
    onError(null);

    let currentStep = "batch_create";
    const uploadedDescriptors: Array<{
      fileId: string;
      clientId: string;
      filename: string;
      mimeType: string;
      pageOrder: number;
      storagePath: string;
      pdfPageNumber?: number;
    }> = [];

    try {
      const currentBatchId = await ensureBatch();
      let pageOrderCursor = 1;

      for (const item of sortedFiles) {
        if (item.status === "skipped") continue;
        const file = fileRegistry.current.get(item.clientId);
        if (!file) continue;

        currentStep = `upload-page-${item.pageOrder}`;
        setFiles((current) =>
          current.map((entry) =>
            entry.clientId === item.clientId ? { ...entry, status: "uploading", error: undefined } : entry,
          ),
        );

        console.log("[ProgrammingImport] upload-start", item.clientId);
        const descriptor = await uploadBatchFile({
          batchId: currentBatchId,
          pageOrder: pageOrderCursor,
          clientFileId: item.clientId,
          file,
        });

        console.log("[ProgrammingImport] upload-success", item.clientId);
        pageOrderCursor += 1;
        uploadedDescriptors.push({ ...descriptor, clientId: item.clientId });

        setFiles((current) =>
          current.map((entryRow) =>
            entryRow.clientId === item.clientId
              ? {
                  ...entryRow,
                  status: "uploaded",
                  fileId: descriptor.fileId,
                  storagePath: descriptor.storagePath,
                  pdfPageNumber: descriptor.pdfPageNumber,
                }
              : entryRow,
          ),
        );
      }

      if (uploadedDescriptors.length > 0) {
        setLastUploadedBatch({ batchId: currentBatchId, pages: uploadedDescriptors });
        await fetch("/api/programmation/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "batch_reorder",
            batchId: currentBatchId,
            orderedFileIds: uploadedDescriptors.map((entry) => entry.fileId),
          }),
        });
      }

      currentStep = "analyze";
      setUiState("analyzing");
      setAnalyzeProgress({ current: 0, total: uploadedDescriptors.length });

      const analyzeResult = await runAnalyzeWithFallback({
        currentBatchId,
        pages: uploadedDescriptors,
        onPageStart: (current, total) => setAnalyzeProgress({ current, total }),
        onPageComplete: (remote) => {
          setFiles((current) =>
            current.map((entry) =>
              entry.fileId === remote.fileId
                ? { ...entry, status: remote.status, error: remote.error }
                : entry,
            ),
          );
        },
      });

      setAnalyzeProgress(null);

      console.log("[ProgrammingImport] analysis-success", currentBatchId);
      setFiles((current) =>
        current.map((entry) => {
          const remote = analyzeResult.fileStatuses.find((remoteFile) => remoteFile.fileId === entry.fileId);
          if (!remote) return { ...entry, status: "analyzed" as ImportedFileStatus };
          return { ...entry, status: remote.status, error: remote.error };
        }),
      );

      currentStep = "merge";
      setUiState("merging");
      console.log("[ProgrammingImport] merge-start");

      setUiState("review");
      console.log("[ProgrammingImport] completed", currentBatchId);
      onAnalyzed(analyzeResult.parsed, currentBatchId, analyzeResult.storagePaths);
    } catch (importError) {
      setAnalyzeProgress(null);
      const rawMessage = importError instanceof Error ? importError.message : "";
      const message = mapImportFailureMessage(currentStep, rawMessage);
      console.error("[ProgrammingImport] failed", { step: currentStep, error: message });
      setUiState("error");
      setFailureStep(currentStep);
      onError(message);
    }
  }, [ensureBatch, onAnalyzed, onError, runAnalyzeWithFallback, sortedFiles]);

  const continueWithoutAnalysis = useCallback(() => {
    const uploadedPages =
      lastUploadedBatch?.pages ??
      sortedFiles
        .filter((item) => item.fileId && item.storagePath && item.status !== "skipped")
        .map((item) => ({
          fileId: item.fileId!,
          clientId: item.clientId,
          filename: item.filename,
          mimeType: item.mimeType,
          pageOrder: item.pageOrder,
          storagePath: item.storagePath!,
          pdfPageNumber: item.pdfPageNumber,
        }));

    if (uploadedPages.length === 0) {
      onError("Aucun fichier téléversé disponible.");
      return;
    }

    const currentBatchId = lastUploadedBatch?.batchId ?? batchId;
    const parsed = buildMinimalParsedFromUpload({
      batchId: currentBatchId,
      mergeMode,
      pages: uploadedPages,
    });

    setAnalyzeProgress(null);
    setUiState("review");
    setFailureStep(null);
    onError(null);
    onAnalyzed(
      parsed,
      currentBatchId,
      uploadedPages.map((page) => page.storagePath),
    );
  }, [batchId, lastUploadedBatch, mergeMode, onAnalyzed, onError, sortedFiles]);

  const retryAnalysis = useCallback(async () => {
    const activePages = sortedFiles.filter(
      (item) =>
        item.status !== "skipped" &&
        item.fileId &&
        item.storagePath &&
        fileRegistry.current.has(item.clientId),
    );

    if (activePages.length === 0) {
      onError("Aucune page téléversée disponible pour relancer l'analyse.");
      return;
    }

    setUiState("analyzing");
    setFailureStep(null);
    onError(null);
    setAnalyzeProgress({ current: 0, total: activePages.length });

    try {
      const pages = activePages.map((item) => ({
        fileId: item.fileId!,
        clientId: item.clientId,
        filename: item.filename,
        mimeType: item.mimeType,
        pageOrder: item.pageOrder,
        storagePath: item.storagePath!,
        pdfPageNumber: item.pdfPageNumber,
      }));

      const analyzeResult = await runAnalyzeWithFallback({
        currentBatchId: batchId,
        pages,
        onPageStart: (current, total) => setAnalyzeProgress({ current, total }),
        onPageComplete: (remote) => {
          setFiles((current) =>
            current.map((entry) =>
              entry.fileId === remote.fileId
                ? { ...entry, status: remote.status, error: remote.error }
                : entry,
            ),
          );
        },
      });

      setAnalyzeProgress(null);

      setFiles((current) =>
        current.map((entry) => {
          const remote = analyzeResult.fileStatuses.find((remoteFile) => remoteFile.fileId === entry.fileId);
          if (!remote) return { ...entry, status: "analyzed" as ImportedFileStatus, error: undefined };
          return { ...entry, status: remote.status, error: remote.error };
        }),
      );

      setUiState("review");
      onAnalyzed(analyzeResult.parsed, batchId, analyzeResult.storagePaths);
    } catch (importError) {
      setAnalyzeProgress(null);
      const message =
        importError instanceof Error
          ? importError.message
          : "L'analyse des pages a échoué.";
      console.error("[ProgrammingImport] analyze-failed", { batchId, step: "analyze", errorMessage: message });
      setUiState("error");
      setFailureStep("analyze");
      onError(message);
    }
  }, [batchId, onAnalyzed, onError, runAnalyzeWithFallback, sortedFiles]);

  const skipFile = useCallback((clientId: string) => {
    setFiles((current) =>
      current.map((item) =>
        item.clientId === clientId ? { ...item, status: "skipped", error: undefined } : item,
      ),
    );
    onError(null);
  }, [onError]);

  const retryImport = useCallback(() => {
    setUiState(fileRegistry.current.count() > 0 ? "files_selected" : "idle");
    onError(null);
    void runBatchImport();
  }, [onError, runBatchImport]);

  const uploadedCount = files.filter((item) =>
    ["uploaded", "analyzed", "analyzing"].includes(item.status),
  ).length;

  const hasUploadedFiles = files.some(
    (item) => item.storagePath && item.fileId && item.status !== "skipped",
  );

  const canContinueWithoutAnalysis =
    hasUploadedFiles && (uiState === "error" || uiState === "analyzing");

  return (
    <div className="programming-import-panel w-full max-w-full box-border space-y-4 overflow-x-hidden">
      <p className="break-words text-sm font-light text-flora-text-subtle">{formatBatchLimitsLabel()}</p>

      <div className="w-full max-w-full rounded-2xl bg-white/45 p-4 box-border">
        <p className="text-sm font-medium">Ces fichiers constituent-ils :</p>
        <div className="mt-2 flex w-full max-w-full flex-col gap-2">
          <button
            type="button"
            onClick={() => setMergeMode("single_document")}
            className={`w-full max-w-full rounded-2xl px-3 py-2.5 text-left text-sm leading-snug break-words ${
              mergeMode === "single_document" ? "bg-sauge/30 text-flora-text" : "bg-white/60"
            }`}
          >
            Un seul document de plusieurs pages
          </button>
          <button
            type="button"
            onClick={() => setMergeMode("multiple_programmations")}
            className={`w-full max-w-full rounded-2xl px-3 py-2.5 text-left text-sm leading-snug break-words ${
              mergeMode === "multiple_programmations" ? "bg-sauge/30 text-flora-text" : "bg-white/60"
            }`}
          >
            Plusieurs programmations différentes
          </button>
        </div>
      </div>

      <div
        className={`w-full max-w-full rounded-2xl border-2 border-dashed px-4 py-6 text-center box-border ${
          dragActive ? "border-sauge bg-white/70" : "border-white/70 bg-white/35"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          const dropped = Array.from(event.dataTransfer.files ?? []);
          if (dropped.length > 0) registerIncomingFiles(dropped);
        }}
      >
        <p className="break-words text-sm font-light">
          Glissez-déposez vos pages ici ou sélectionnez plusieurs fichiers.
        </p>
        <div className="mt-4 flex w-full max-w-full flex-col gap-2">
          <FloraButton
            className="!w-full !max-w-full"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
          >
            Sélectionner des fichiers
          </FloraButton>
          {files.length > 0 ? (
            <FloraButton
              className="!w-full !max-w-full"
              variant="secondary"
              onClick={() => addInputRef.current?.click()}
              disabled={isBusy}
            >
              Ajouter des pages
            </FloraButton>
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            if (selected.length > 0) registerIncomingFiles(selected);
            event.target.value = "";
          }}
        />
        <input
          ref={addInputRef}
          type="file"
          multiple
          accept={accept}
          className="hidden"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            if (selected.length > 0) registerIncomingFiles(selected);
            event.target.value = "";
          }}
        />
      </div>

      {duplicatePrompt ? (
        <div className="w-full max-w-full rounded-2xl bg-peach/30 px-4 py-3 text-sm box-border">
          <p className="break-words">
            Fichier(s) déjà présent(s) : {duplicatePrompt.join(", ")}. Conserver quand même ?
          </p>
          <div className="mt-2 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
            <FloraButton className="!w-full" size="sm" onClick={confirmDuplicateAdd}>
              Conserver
            </FloraButton>
            <FloraButton className="!w-full" size="sm" variant="secondary" onClick={() => setDuplicatePrompt(null)}>
              Annuler
            </FloraButton>
          </div>
        </div>
      ) : null}

      {sortedFiles.length > 0 ? (
        <ul className="grid w-full max-w-full grid-cols-1 gap-3">
          {sortedFiles.map((item) => (
            <li
              key={item.clientId}
              className="w-full max-w-full rounded-2xl border border-white/70 bg-white/55 p-3 box-border"
            >
              <div className="flex w-full max-w-full gap-3">
                <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/70">
                  {item.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-flora-text-subtle">DOC</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-flora-text-subtle">
                    Page {item.pageOrder}
                    {item.pdfPageNumber ? ` · PDF p.${item.pdfPageNumber}` : ""}
                  </p>
                  <p className="break-all text-sm font-medium leading-snug">{item.filename}</p>
                  <p className="text-xs text-flora-text-subtle">{STATUS_LABELS[item.status]}</p>
                  {item.error ? <p className="break-words text-xs text-[#b88989]">{item.error}</p> : null}
                </div>
              </div>
              <div className="mt-3 grid w-full grid-cols-2 gap-2">
                <FloraButton className="!w-full !max-w-full" size="sm" variant="secondary" onClick={() => moveFile(item.clientId, -1)} disabled={isBusy}>
                  Monter
                </FloraButton>
                <FloraButton className="!w-full !max-w-full" size="sm" variant="secondary" onClick={() => moveFile(item.clientId, 1)} disabled={isBusy}>
                  Descendre
                </FloraButton>
                <FloraButton className="!w-full !max-w-full" size="sm" variant="secondary" onClick={() => removeFile(item.clientId)} disabled={isBusy}>
                  Supprimer
                </FloraButton>
                {item.status === "error" ? (
                  <FloraButton
                    className="!w-full !max-w-full"
                    size="sm"
                    variant="secondary"
                    onClick={() => skipFile(item.clientId)}
                    disabled={isBusy}
                  >
                    Continuer sans cette page
                  </FloraButton>
                ) : null}
                <label className="block w-full max-w-full cursor-pointer">
                  <span className="inline-flex w-full max-w-full items-center justify-center rounded-full bg-white/70 px-3 py-2 text-xs">
                    Remplacer
                  </span>
                  <input
                    type="file"
                    accept={accept}
                    className="hidden"
                    disabled={isBusy}
                    onChange={(event) => {
                      const replacement = event.target.files?.[0];
                      if (replacement) replaceFile(item.clientId, replacement);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {uiState === "uploading" || uiState === "analyzing" || uiState === "merging" ? (
        <div className="w-full max-w-full rounded-2xl bg-white/50 px-4 py-3 text-sm box-border">
          <p className="break-words">
            {uiState === "uploading"
              ? `Téléversement : ${uploadedCount} / ${files.length}`
              : uiState === "analyzing"
                ? analyzeProgress
                  ? `Analyse page ${analyzeProgress.current} / ${analyzeProgress.total}…`
                  : "Analyse des pages…"
                : "Fusion des données…"}
          </p>
        </div>
      ) : null}

      {failureStep ? (
        <p className="break-words text-xs text-flora-text-subtle">
          {failureStep === "analyze"
            ? "L'analyse a échoué. Vous pouvez réessayer, remplacer une page ou continuer sans elle."
            : `Étape en échec : ${failureStep}`}
        </p>
      ) : null}

      <div className="flex w-full max-w-full flex-col gap-2">
        <FloraButton
          type="button"
          className="!w-full !max-w-full"
          onClick={() => void runBatchImport()}
          disabled={files.length === 0 || isBusy}
        >
          {isBusy ? "Traitement…" : "Analyser la programmation"}
        </FloraButton>
        {uiState === "error" && failureStep === "analyze" ? (
          <FloraButton type="button" className="!w-full !max-w-full" variant="secondary" onClick={() => void retryAnalysis()}>
            Réessayer l&apos;analyse
          </FloraButton>
        ) : null}
        {canContinueWithoutAnalysis ? (
          <FloraButton
            type="button"
            className="!w-full !max-w-full"
            variant="secondary"
            onClick={continueWithoutAnalysis}
            disabled={isBusy && uiState !== "analyzing"}
          >
            Continuer avec les fichiers téléversés
          </FloraButton>
        ) : null}
        {uiState === "error" && failureStep !== "analyze" ? (
          <FloraButton type="button" className="!w-full !max-w-full" variant="secondary" onClick={retryImport}>
            Réessayer
          </FloraButton>
        ) : null}
      </div>

      <p className="break-words text-xs text-flora-text-subtle">
        Maximum {PROGRAMMATION_IMPORT_BATCH_LIMITS.maxFiles} fichiers · mélange PNG, JPG, PDF, DOCX, XLSX accepté.
      </p>
    </div>
  );
}
