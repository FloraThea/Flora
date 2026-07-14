import {
  getFileExtension,
  isAcceptedForModule,
  validateImportFile,
} from "@/lib/import/accepted-formats";
import { PROGRAMMATION_IMPORT_BATCH_LIMITS } from "./batch-limits";

export type BatchValidationResult =
  | { ok: true }
  | { ok: false; error: string; code?: string };

export function fileFingerprint(file: Pick<File, "name" | "size" | "lastModified">): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function validateBatchFiles(
  files: Array<Pick<File, "name" | "type" | "size" | "lastModified">>,
): BatchValidationResult {
  if (files.length === 0) {
    return { ok: false, error: "Sélectionnez au moins un fichier.", code: "empty" };
  }

  if (files.length > PROGRAMMATION_IMPORT_BATCH_LIMITS.maxFiles) {
    return {
      ok: false,
      error: `Maximum ${PROGRAMMATION_IMPORT_BATCH_LIMITS.maxFiles} fichiers par import.`,
      code: "too_many_files",
    };
  }

  let totalBytes = 0;
  const seen = new Set<string>();

  for (const file of files) {
    const validation = validateImportFile(
      "programmation",
      file,
      PROGRAMMATION_IMPORT_BATCH_LIMITS.maxFileBytes,
    );
    if (!validation.ok) return validation;

    if (!isAcceptedForModule("programmation", file.name, file.type)) {
      return {
        ok: false,
        error: `Format non supporté : ${file.name}`,
        code: "unsupported_format",
      };
    }

    const ext = getFileExtension(file.name);
    if (!ext) {
      return { ok: false, error: `Extension manquante : ${file.name}`, code: "no_extension" };
    }

    totalBytes += file.size;
    seen.add(fileFingerprint(file));
  }

  if (totalBytes > PROGRAMMATION_IMPORT_BATCH_LIMITS.maxTotalBytes) {
    return {
      ok: false,
      error: `Lot trop volumineux (max ${Math.round(PROGRAMMATION_IMPORT_BATCH_LIMITS.maxTotalBytes / (1024 * 1024))} Mo au total).`,
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
