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
import {
  ImportFileRegistry,
  mapImportFailureMessage,
  parseImportApiError,
  uploadBatchFile,
  type ImportWorkflowStep,
} from "@/lib/programming/import/import-batch-client";
import type { ParsedProgrammationImport } from "@/lib/programming/import/types";

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
    const data = (await response.json()) as {
      batchId?: string;
      error?: string;
      details?: string;
    };
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
        uploadedDescriptors.push(descriptor);

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
      console.log("[ProgrammingImport] analysis-start", currentBatchId);

      const analyzeResponse = await fetch("/api/programmation/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_analyze",
          batchId: currentBatchId,
          mergeMode,
          uploadedFiles: uploadedDescriptors,
        }),
      });

      const analyzeData = (await analyzeResponse.json()) as {
        parsed?: ParsedProgrammationImport;
        files?: Array<{ fileId: string; status: ImportedFileStatus; error?: string }>;
        error?: string;
        details?: string;
      };

      if (!analyzeResponse.ok || !analyzeData.parsed) {
        throw new Error(parseImportApiError(analyzeData, "L'analyse des pages a échoué."));
      }

      console.log("[ProgrammingImport] analysis-success", currentBatchId);
      setFiles((current) =>
        current.map((entry) => {
          const remote = analyzeData.files?.find((remoteFile) => remoteFile.fileId === entry.fileId);
          if (!remote) return { ...entry, status: "analyzed" as ImportedFileStatus };
          return { ...entry, status: remote.status, error: remote.error };
        }),
      );

      currentStep = "merge";
      setUiState("merging");
      console.log("[ProgrammingImport] merge-start");

      const storagePaths = uploadedDescriptors.map((entry) => entry.storagePath);
      setUiState("review");
      console.log("[ProgrammingImport] completed", currentBatchId);
      onAnalyzed(analyzeData.parsed, currentBatchId, storagePaths);
    } catch (importError) {
      const rawMessage = importError instanceof Error ? importError.message : "";
      const message = mapImportFailureMessage(currentStep, rawMessage);
      console.error("[ProgrammingImport] failed", { step: currentStep, error: message });
      setUiState("error");
      setFailureStep(currentStep);
      onError(message);
    }
  }, [ensureBatch, mergeMode, onAnalyzed, onError, sortedFiles]);

  const retryImport = useCallback(() => {
    setUiState(fileRegistry.current.count() > 0 ? "files_selected" : "idle");
    onError(null);
    void runBatchImport();
  }, [onError, runBatchImport]);

  const uploadedCount = files.filter((item) =>
    ["uploaded", "analyzed", "analyzing"].includes(item.status),
  ).length;

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
                ? "Analyse des pages…"
                : "Fusion des données…"}
          </p>
        </div>
      ) : null}

      {failureStep ? (
        <p className="break-words text-xs text-flora-text-subtle">Étape en échec : {failureStep}</p>
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
        {uiState === "error" ? (
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
