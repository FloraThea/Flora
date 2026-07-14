import type { Dispatch, SetStateAction } from "react";
import { isLikelyBoDocument } from "@/lib/library/category-mapper";
import { isUnifiedAcceptedFile } from "@/lib/library/types";
import { importFilesWithProgress, type MultiUploadState } from "./import-manager";

export async function importUnifiedFiles(
  files: File[],
  setUploadState: Dispatch<SetStateAction<MultiUploadState>>,
  onComplete?: () => void,
): Promise<void> {
  const pedagogicalFiles: File[] = [];
  const boFiles: File[] = [];

  for (const file of files) {
    if (!isUnifiedAcceptedFile(file.name, file.type)) {
      setUploadState((current) => ({
        ...current,
        globalError: `Format non supporté : ${file.name}`,
      }));
      continue;
    }

    if (isLikelyBoDocument(file.name, file.type)) {
      boFiles.push(file);
    } else {
      pedagogicalFiles.push(file);
    }
  }

  for (const file of boFiles) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/centre-ressources/import", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json()) as { error?: string; storageWarning?: string | null };

    if (!response.ok) {
      setUploadState((current) => ({
        ...current,
        globalError: payload.error || `Import BO impossible pour ${file.name}.`,
      }));
      continue;
    }

    setUploadState((current) => ({
      ...current,
      globalMessage: payload.storageWarning
        ? `Référentiel BO importé (${file.name}). ${payload.storageWarning}`
        : `Référentiel BO importé : ${file.name}. Analysez-le depuis la fiche document.`,
    }));
  }

  if (pedagogicalFiles.length > 0) {
    await importFilesWithProgress(pedagogicalFiles, setUploadState);
  }

  onComplete?.();
}
