"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { getModuleAcceptAttribute } from "@/lib/import/accepted-formats";
import { formatBatchLimitsLabel, PROGRAMMATION_IMPORT_BATCH_LIMITS } from "@/lib/programming/import/batch-limits";
import {
  findDuplicateFiles,
  validateBatchFiles,
} from "@/lib/programming/import/batch-validation";
import type { ImportBatchMergeMode, ImportedFileStatus } from "@/lib/programming/import/batch-types";
import type { ParsedProgrammationImport } from "@/lib/programming/import/types";
import { isSupportedImageFile } from "@/lib/import/accepted-formats";

export type BatchPanelFile = {
  clientId: string;
  file?: File;
  fileId?: string;
  filename: string;
  mimeType: string;
  pageOrder: number;
  pdfPageNumber?: number;
  previewUrl?: string;
  status: ImportedFileStatus;
  error?: string;
  storagePath?: string;
};

type Props = {
  schoolYear: string;
  onAnalyzed: (parsed: ParsedProgrammationImport, batchId: string, storagePaths: string[]) => void;
  onError: (message: string) => void;
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

function buildPreviewUrl(file: File): string | undefined {
  if (isSupportedImageFile(file.name, file.type)) {
    return URL.createObjectURL(file);
  }
  return undefined;
}

function openFilePicker(input: HTMLInputElement | null) {
  input?.click();
}

export function ProgrammationImportBatchPanel({ schoolYear, onAnalyzed, onError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [files, setFiles] = useState<BatchPanelFile[]>([]);
  const [mergeMode, setMergeMode] = useState<ImportBatchMergeMode>("single_document");
  const [phase, setPhase] = useState<
    "idle" | "uploading" | "analyzing" | "merging" | "creating" | "done"
  >("idle");
  const [dragActive, setDragActive] = useState(false);
  const [duplicatePrompt, setDuplicatePrompt] = useState<string[] | null>(null);
  const [pendingAddFiles, setPendingAddFiles] = useState<File[]>([]);

  const accept = getModuleAcceptAttribute("programmation");

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
    if (batchId) return batchId;
    const response = await fetch("/api/programmation/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "batch_create",
        schoolYear,
        mergeMode,
      }),
    });
    const data = (await response.json()) as { batchId?: string; error?: string };
    if (!response.ok || !data.batchId) {
      throw new Error(data.error || "Impossible de créer le lot.");
    }
    setBatchId(data.batchId);
    return data.batchId;
  }, [batchId, mergeMode, schoolYear]);

  const addLocalFiles = useCallback((incoming: File[]) => {
    const validation = validateBatchFiles([...files.map((f) => f.file).filter(Boolean) as File[], ...incoming]);
    if (!validation.ok) {
      onError(validation.error);
      return;
    }

    const existingFiles = files.map((item) => item.file).filter(Boolean) as File[];
    const duplicates = findDuplicateFiles(existingFiles, incoming);
    if (duplicates.length > 0) {
      setDuplicatePrompt(duplicates);
      setPendingAddFiles(incoming);
      return;
    }

    const startOrder = files.length + 1;
    const nextItems: BatchPanelFile[] = incoming.map((file, index) => ({
      clientId: createClientId(),
      file,
      filename: file.name,
      mimeType: file.type,
      pageOrder: startOrder + index,
      previewUrl: buildPreviewUrl(file),
      status: "pending",
    }));
    setFiles((current) => [...current, ...nextItems]);
  }, [files, onError]);

  const confirmDuplicateAdd = useCallback(() => {
    if (pendingAddFiles.length === 0) return;
    const startOrder = files.length + 1;
    const nextItems: BatchPanelFile[] = pendingAddFiles.map((file, index) => ({
      clientId: createClientId(),
      file,
      filename: file.name,
      mimeType: file.type,
      pageOrder: startOrder + index,
      previewUrl: buildPreviewUrl(file),
      status: "pending",
    }));
    setFiles((current) => [...current, ...nextItems]);
    setPendingAddFiles([]);
    setDuplicatePrompt(null);
  }, [files.length, pendingAddFiles]);

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
      const filtered = current.filter((item) => item.clientId !== clientId);
      return filtered.map((item, index) => ({ ...item, pageOrder: index + 1 }));
    });
  }, []);

  const replaceFile = useCallback((clientId: string, replacement: File) => {
    setFiles((current) =>
      current.map((item) => {
        if (item.clientId !== clientId) return item;
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
        return {
          ...item,
          file: replacement,
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
  }, []);

  const runBatchImport = useCallback(async () => {
    const localFiles = files.filter((item) => item.file);
    if (localFiles.length === 0) {
      onError("Ajoutez au moins un fichier.");
      return;
    }

    setPhase("uploading");
    onError("");

    try {
      const currentBatchId = await ensureBatch();
      let pageOrderCursor = 1;
      const uploadedFileIds: string[] = [];

      for (const item of sortedFiles) {
        if (!item.file) continue;
        setFiles((current) =>
          current.map((entry) =>
            entry.clientId === item.clientId ? { ...entry, status: "uploading" } : entry,
          ),
        );

        const formData = new FormData();
        formData.append("action", "batch_upload");
        formData.append("batchId", currentBatchId);
        formData.append("pageOrder", String(pageOrderCursor));
        formData.append("file", item.file);

        const response = await fetch("/api/programmation/import", { method: "POST", body: formData });
        const data = (await response.json()) as {
          entries?: Array<{ fileId: string; pageOrder: number; pdfPageNumber?: number; storagePath: string }>;
          error?: string;
        };

        if (!response.ok || !data.entries?.length) {
          throw new Error(data.error || `Échec téléversement ${item.filename}`);
        }

        pageOrderCursor += data.entries.length;
        uploadedFileIds.push(...data.entries.map((entry) => entry.fileId));

        if (data.entries.length === 1) {
          setFiles((current) =>
            current.map((entry) =>
              entry.clientId === item.clientId
                ? {
                    ...entry,
                    status: "uploaded",
                    fileId: data.entries![0]?.fileId,
                    storagePath: data.entries![0]?.storagePath,
                    pdfPageNumber: data.entries![0]?.pdfPageNumber,
                  }
                : entry,
            ),
          );
        } else {
          setFiles((current) => {
            const without = current.filter((entry) => entry.clientId !== item.clientId);
            const expanded = data.entries!.map((entry, index) => ({
              clientId: `${item.clientId}-pdf-${index}`,
              filename: item.filename,
              mimeType: item.mimeType,
              pageOrder: entry.pageOrder,
              pdfPageNumber: entry.pdfPageNumber,
              status: "uploaded" as ImportedFileStatus,
              fileId: entry.fileId,
              storagePath: entry.storagePath,
            }));
            return [...without, ...expanded].map((entry, index) => ({
              ...entry,
              pageOrder: index + 1,
            }));
          });
        }
      }

      if (uploadedFileIds.length > 0) {
        await fetch("/api/programmation/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "batch_reorder",
            batchId: currentBatchId,
            orderedFileIds: uploadedFileIds,
          }),
        });
      }

      setPhase("analyzing");
      const analyzeResponse = await fetch("/api/programmation/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch_analyze",
          batchId: currentBatchId,
        }),
      });

      const analyzeData = (await analyzeResponse.json()) as {
        parsed?: ParsedProgrammationImport;
        files?: Array<{ fileId: string; status: ImportedFileStatus; error?: string }>;
        error?: string;
      };

      if (!analyzeResponse.ok || !analyzeData.parsed) {
        throw new Error(analyzeData.error || "Analyse du lot impossible.");
      }

      setFiles((current) =>
        current.map((entry) => {
          const remote = analyzeData.files?.find((item) => item.fileId === entry.fileId);
          if (!remote) return entry;
          return {
            ...entry,
            status: remote.status,
            error: remote.error,
          };
        }),
      );

      setPhase("merging");
      const storagePaths = sortedFiles.map((item) => item.storagePath).filter(Boolean) as string[];
      setPhase("done");
      onAnalyzed(analyzeData.parsed, currentBatchId, storagePaths);
    } catch (importError) {
      setPhase("idle");
      onError(importError instanceof Error ? importError.message : "Import impossible.");
    }
  }, [ensureBatch, files, onAnalyzed, onError, sortedFiles]);

  const uploadedCount = files.filter((item) =>
    ["uploaded", "analyzed", "analyzing"].includes(item.status),
  ).length;

  return (
    <div className="space-y-4">
      <p className="text-sm font-light text-flora-text-subtle">{formatBatchLimitsLabel()}</p>

      <div className="rounded-2xl bg-white/45 p-4">
        <p className="text-sm font-medium">Ces fichiers constituent-ils :</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMergeMode("single_document")}
            className={`rounded-full px-3 py-1.5 text-xs ${
              mergeMode === "single_document" ? "bg-sauge/30 text-flora-text" : "bg-white/60"
            }`}
          >
            Un seul document de plusieurs pages
          </button>
          <button
            type="button"
            onClick={() => setMergeMode("multiple_programmations")}
            className={`rounded-full px-3 py-1.5 text-xs ${
              mergeMode === "multiple_programmations" ? "bg-sauge/30 text-flora-text" : "bg-white/60"
            }`}
          >
            Plusieurs programmations différentes
          </button>
        </div>
      </div>

      <div
        className={`rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
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
          if (dropped.length > 0) addLocalFiles(dropped);
        }}
      >
        <p className="text-sm font-light">Glissez-déposez vos pages ici ou sélectionnez plusieurs fichiers.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <FloraButton onClick={() => openFilePicker(inputRef.current)} disabled={phase !== "idle" && phase !== "done"}>
            Sélectionner des fichiers
          </FloraButton>
          {files.length > 0 ? (
            <FloraButton variant="secondary" onClick={() => openFilePicker(addInputRef.current)}>
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
            if (selected.length > 0) addLocalFiles(selected);
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
            if (selected.length > 0) addLocalFiles(selected);
            event.target.value = "";
          }}
        />
      </div>

      {duplicatePrompt ? (
        <div className="rounded-2xl bg-peach/30 px-4 py-3 text-sm">
          <p>Fichier(s) déjà présent(s) : {duplicatePrompt.join(", ")}. Conserver quand même ?</p>
          <div className="mt-2 flex gap-2">
            <FloraButton size="sm" onClick={confirmDuplicateAdd}>
              Conserver
            </FloraButton>
            <FloraButton size="sm" variant="secondary" onClick={() => setDuplicatePrompt(null)}>
              Annuler
            </FloraButton>
          </div>
        </div>
      ) : null}

      {sortedFiles.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sortedFiles.map((item) => (
            <li
              key={item.clientId}
              className="rounded-2xl border border-white/70 bg-white/55 p-3"
            >
              <div className="flex gap-3">
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
                  <p className="truncate text-sm font-medium">{item.filename}</p>
                  <p className="text-xs text-flora-text-subtle">{STATUS_LABELS[item.status]}</p>
                  {item.error ? <p className="text-xs text-[#b88989]">{item.error}</p> : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <FloraButton size="sm" variant="secondary" onClick={() => moveFile(item.clientId, "first")}>
                  ⏫
                </FloraButton>
                <FloraButton size="sm" variant="secondary" onClick={() => moveFile(item.clientId, -1)}>
                  Monter
                </FloraButton>
                <FloraButton size="sm" variant="secondary" onClick={() => moveFile(item.clientId, 1)}>
                  Descendre
                </FloraButton>
                <FloraButton size="sm" variant="secondary" onClick={() => moveFile(item.clientId, "last")}>
                  ⏬
                </FloraButton>
                <FloraButton size="sm" variant="secondary" onClick={() => removeFile(item.clientId)}>
                  Supprimer
                </FloraButton>
                <label className="cursor-pointer">
                  <span className="inline-flex rounded-full bg-white/70 px-3 py-1 text-xs">Remplacer</span>
                  <input
                    type="file"
                    accept={accept}
                    className="hidden"
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

      {phase !== "idle" ? (
        <div className="rounded-2xl bg-white/50 px-4 py-3 text-sm">
          <p>
            {phase === "uploading"
              ? `Téléversement : ${uploadedCount} / ${files.length}`
              : phase === "analyzing"
                ? "Analyse des pages…"
                : phase === "merging"
                  ? "Fusion des données…"
                  : "Analyse terminée"}
          </p>
        </div>
      ) : null}

      <FloraButton
        onClick={() => void runBatchImport()}
        disabled={files.length === 0 || (phase !== "idle" && phase !== "done")}
      >
        {phase === "uploading" || phase === "analyzing" ? "Traitement…" : "Analyser le lot"}
      </FloraButton>

      <p className="text-xs text-flora-text-subtle">
        Maximum {PROGRAMMATION_IMPORT_BATCH_LIMITS.maxFiles} fichiers · mélange PNG, JPG, PDF, DOCX, XLSX accepté.
      </p>
    </div>
  );
}
