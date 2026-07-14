"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import {
  getFormatsAcceptesLabel,
  getModuleAcceptAttribute,
  isSupportedImageFile,
  type ImportModule,
} from "@/lib/import/accepted-formats";
import { formatSharedBatchLimitsLabel } from "@/lib/import/batch-limits-shared";
import {
  findDuplicateFiles,
  validateBatchFilesForModule,
} from "@/lib/import/batch-validation-shared";
import { ImportFileRegistry } from "@/lib/import/file-registry";

export type ImportBatchMergeMode = "single_document" | "multiple_documents";

export type ImportBatchFileStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "analyzing"
  | "analyzed"
  | "error"
  | "skipped";

export type ImportBatchPanelFile = {
  clientId: string;
  filename: string;
  mimeType: string;
  pageOrder: number;
  previewUrl?: string;
  status: ImportBatchFileStatus;
  error?: string;
};

export type ImportBatchAnalyzeInput = {
  items: Array<{ clientId: string; file: File }>;
  mergeMode: ImportBatchMergeMode;
  setFileStatus: (clientId: string, status: ImportBatchFileStatus, error?: string) => void;
};

type ImportBatchPanelProps = {
  module: ImportModule;
  analyzeButtonLabel: string;
  singleDocumentLabel?: string;
  multipleDocumentsLabel?: string;
  onAnalyze: (input: ImportBatchAnalyzeInput) => Promise<void>;
  onError: (message: string | null) => void;
  disabled?: boolean;
};

const STATUS_LABELS: Record<ImportBatchFileStatus, string> = {
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

function buildPreviewUrl(file: File): string | undefined {
  if (isSupportedImageFile(file.name, file.type)) {
    return URL.createObjectURL(file);
  }
  return undefined;
}

export function ImportBatchPanel({
  module,
  analyzeButtonLabel,
  singleDocumentLabel = "Un seul document de plusieurs pages",
  multipleDocumentsLabel = "Plusieurs documents différents",
  onAnalyze,
  onError,
  disabled = false,
}: ImportBatchPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const fileRegistry = useRef(new ImportFileRegistry());
  const [files, setFiles] = useState<ImportBatchPanelFile[]>([]);
  const [mergeMode, setMergeMode] = useState<ImportBatchMergeMode>("single_document");
  const [isBusy, setIsBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<string[] | null>(null);
  const [pendingAddFiles, setPendingAddFiles] = useState<File[]>([]);

  const accept = getModuleAcceptAttribute(module);

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

  const setFileStatus = useCallback(
    (clientId: string, status: ImportBatchFileStatus, error?: string) => {
      setFiles((current) =>
        current.map((item) =>
          item.clientId === clientId ? { ...item, status, error: error ?? item.error } : item,
        ),
      );
    },
    [],
  );

  const reorderFiles = useCallback((next: ImportBatchPanelFile[]) => {
    setFiles(
      next.map((item, index) => ({
        ...item,
        pageOrder: index + 1,
      })),
    );
  }, []);

  const registerIncomingFiles = useCallback(
    (incoming: File[]) => {
      const registryFiles = sortedFiles
        .map((item) => fileRegistry.current.get(item.clientId))
        .filter(Boolean) as File[];

      const validation = validateBatchFilesForModule(module, [...registryFiles, ...incoming]);
      if (!validation.ok) {
        onError(validation.error);
        return;
      }

      const duplicates = findDuplicateFiles(registryFiles, incoming);
      if (duplicates.length > 0) {
        setPendingAddFiles(incoming);
        setDuplicatePrompt(duplicates);
        return;
      }

      const startOrder = files.length;
      const added: ImportBatchPanelFile[] = incoming.map((file, index) => {
        const clientId = createClientId();
        fileRegistry.current.set(clientId, file);
        return {
          clientId,
          filename: file.name,
          mimeType: file.type,
          pageOrder: startOrder + index + 1,
          previewUrl: buildPreviewUrl(file),
          status: "pending" as const,
        };
      });

      setFiles((current) => [...current, ...added]);
      onError(null);
    },
    [files.length, module, onError, sortedFiles, files],
  );

  const confirmDuplicateAdd = useCallback(() => {
    if (pendingAddFiles.length === 0) {
      setDuplicatePrompt(null);
      return;
    }
    const startOrder = files.length;
    const added: ImportBatchPanelFile[] = pendingAddFiles.map((file, index) => {
      const clientId = createClientId();
      fileRegistry.current.set(clientId, file);
      return {
        clientId,
        filename: file.name,
        mimeType: file.type,
        pageOrder: startOrder + index + 1,
        previewUrl: buildPreviewUrl(file),
        status: "pending" as const,
      };
    });
    setFiles((current) => [...current, ...added]);
    setPendingAddFiles([]);
    setDuplicatePrompt(null);
    onError(null);
  }, [files.length, onError, pendingAddFiles]);

  const moveFile = useCallback(
    (clientId: string, direction: -1 | 1) => {
      const index = sortedFiles.findIndex((item) => item.clientId === clientId);
      if (index < 0) return;
      const target = index + direction;
      if (target < 0 || target >= sortedFiles.length) return;
      const next = [...sortedFiles];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      reorderFiles(next);
    },
    [reorderFiles, sortedFiles],
  );

  const removeFile = useCallback((clientId: string) => {
    setFiles((current) => {
      const removed = current.find((item) => item.clientId === clientId);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      fileRegistry.current.delete(clientId);
      return current.filter((item) => item.clientId !== clientId);
    });
  }, []);

  const replaceFile = useCallback(
    (clientId: string, replacement: File) => {
      const validation = validateBatchFilesForModule(module, [replacement]);
      if (!validation.ok) {
        onError(validation.error);
        return;
      }
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
          };
        }),
      );
      onError(null);
    },
    [module, onError],
  );

  const runAnalyze = useCallback(async () => {
    const resolvedFiles = sortedFiles
      .map((item) => {
        const file = fileRegistry.current.get(item.clientId);
        return file ? { meta: item, file } : null;
      })
      .filter(Boolean) as Array<{ meta: ImportBatchPanelFile; file: File }>;

    if (resolvedFiles.length === 0) {
      onError("Sélectionnez au moins un fichier.");
      return;
    }

    setIsBusy(true);
    onError(null);

    try {
      await onAnalyze({
        items: resolvedFiles.map((entry) => ({
          clientId: entry.meta.clientId,
          file: entry.file,
        })),
        mergeMode,
        setFileStatus,
      });
    } catch (analyzeError) {
      onError(analyzeError instanceof Error ? analyzeError.message : "Analyse impossible.");
    } finally {
      setIsBusy(false);
    }
  }, [mergeMode, onAnalyze, onError, setFileStatus, sortedFiles]);

  const busy = isBusy || disabled;

  return (
    <div className="grid w-full max-w-full gap-4 overflow-x-hidden box-border">
      <p className="break-words text-xs text-flora-text-subtle">{getFormatsAcceptesLabel(module)}</p>

      <div className="grid w-full max-w-full grid-cols-1 gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMergeMode("single_document")}
          className={`w-full max-w-full rounded-2xl px-3 py-2.5 text-left text-sm leading-snug break-words ${
            mergeMode === "single_document" ? "bg-sauge/30 text-flora-text" : "bg-white/60"
          }`}
        >
          {singleDocumentLabel}
        </button>
        <button
          type="button"
          onClick={() => setMergeMode("multiple_documents")}
          className={`w-full max-w-full rounded-2xl px-3 py-2.5 text-left text-sm leading-snug break-words ${
            mergeMode === "multiple_documents" ? "bg-sauge/30 text-flora-text" : "bg-white/60"
          }`}
        >
          {multipleDocumentsLabel}
        </button>
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
          Glissez-déposez vos fichiers ici ou sélectionnez plusieurs documents.
        </p>
        <div className="mt-4 flex w-full max-w-full flex-col gap-2">
          <FloraButton
            className="!w-full !max-w-full"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            Sélectionner des fichiers
          </FloraButton>
          {files.length > 0 ? (
            <FloraButton
              className="!w-full !max-w-full"
              variant="secondary"
              onClick={() => addInputRef.current?.click()}
              disabled={busy}
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
            <FloraButton
              className="!w-full"
              size="sm"
              variant="secondary"
              onClick={() => setDuplicatePrompt(null)}
            >
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
                  <p className="text-xs font-medium text-flora-text-subtle">Page {item.pageOrder}</p>
                  <p className="break-all text-sm font-medium leading-snug">{item.filename}</p>
                  <p className="text-xs text-flora-text-subtle">{STATUS_LABELS[item.status]}</p>
                  {item.error ? (
                    <p className="break-words text-xs text-[#b88989]">{item.error}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 grid w-full grid-cols-2 gap-2">
                <FloraButton
                  className="!w-full !max-w-full"
                  size="sm"
                  variant="secondary"
                  onClick={() => moveFile(item.clientId, -1)}
                  disabled={busy}
                >
                  Monter
                </FloraButton>
                <FloraButton
                  className="!w-full !max-w-full"
                  size="sm"
                  variant="secondary"
                  onClick={() => moveFile(item.clientId, 1)}
                  disabled={busy}
                >
                  Descendre
                </FloraButton>
                <FloraButton
                  className="!w-full !max-w-full"
                  size="sm"
                  variant="secondary"
                  onClick={() => removeFile(item.clientId)}
                  disabled={busy}
                >
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
                    disabled={busy}
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

      <div className="flex w-full max-w-full flex-col gap-2">
        <FloraButton
          type="button"
          className="!w-full !max-w-full"
          onClick={() => void runAnalyze()}
          disabled={files.length === 0 || busy}
        >
          {busy ? "Traitement…" : analyzeButtonLabel}
        </FloraButton>
      </div>

      <p className="break-words text-xs text-flora-text-subtle">{formatSharedBatchLimitsLabel()}</p>
    </div>
  );
}
