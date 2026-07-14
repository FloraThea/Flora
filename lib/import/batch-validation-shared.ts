import {
  isAcceptedForModule,
  resolveFileExtension,
  resolveImportFileName,
  validateImportFile,
  type ImportModule,
} from "@/lib/import/accepted-formats";
import { SHARED_IMPORT_BATCH_LIMITS } from "./batch-limits-shared";

export type BatchValidationResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export function fileFingerprint(file: Pick<File, "name" | "size" | "lastModified">): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function validateBatchFilesForModule(
  module: ImportModule,
  files: Array<Pick<File, "name" | "type" | "size" | "lastModified">>,
): BatchValidationResult {
  if (files.length === 0) {
    return { ok: false, error: "Sélectionnez au moins un fichier.", code: "empty" };
  }

  if (files.length > SHARED_IMPORT_BATCH_LIMITS.maxFiles) {
    return {
      ok: false,
      error: `Maximum ${SHARED_IMPORT_BATCH_LIMITS.maxFiles} fichiers par import.`,
      code: "too_many_files",
    };
  }

  let totalBytes = 0;

  for (const file of files) {
    const resolvedName = resolveImportFileName(file);
    const validation = validateImportFile(
      module,
      { ...file, name: resolvedName },
      SHARED_IMPORT_BATCH_LIMITS.maxFileSizeBytes,
    );
    if (!validation.ok) return validation;

    if (!isAcceptedForModule(module, resolvedName, file.type)) {
      return {
        ok: false,
        error: `Format non supporté : ${file.name}`,
        code: "unsupported_format",
      };
    }

    const ext = resolveFileExtension(resolvedName, file.type);
    if (!ext && !file.type.startsWith("image/")) {
      return { ok: false, error: `Extension manquante : ${file.name}`, code: "no_extension" };
    }

    totalBytes += file.size;
  }

  if (totalBytes > SHARED_IMPORT_BATCH_LIMITS.maxTotalSizeBytes) {
    return {
      ok: false,
      error: `Lot trop volumineux (max ${Math.round(SHARED_IMPORT_BATCH_LIMITS.maxTotalSizeBytes / (1024 * 1024))} Mo au total).`,
      code: "total_too_large",
    };
  }

  return { ok: true };
}

export function findDuplicateFiles(
  existing: Array<Pick<File, "name" | "size" | "lastModified">>,
  incoming: Array<Pick<File, "name" | "size" | "lastModified">>,
): string[] {
  const existingSet = new Set(existing.map(fileFingerprint));
  return incoming.filter((file) => existingSet.has(fileFingerprint(file))).map((file) => file.name);
}
