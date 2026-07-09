import type { ImportProgressStage, UploadProgress } from "./types";

export const IMPORT_PROGRESS_STAGES: Array<{
  id: ImportProgressStage;
  label: string;
}> = [
  { id: "preparation", label: "Préparation" },
  { id: "upload", label: "Upload" },
  { id: "verification", label: "Vérification" },
  { id: "analysis", label: "Analyse" },
  { id: "indexing", label: "Indexation" },
  { id: "completed", label: "Terminé" },
];

export function computeUploadProgress(input: {
  uploadedBytes: number;
  totalBytes: number;
  startedAtMs: number;
  label?: string;
  stage?: ImportProgressStage;
}): UploadProgress {
  const percent =
    input.totalBytes > 0
      ? Math.min(100, Math.round((input.uploadedBytes / input.totalBytes) * 100))
      : 0;
  const elapsedSeconds = Math.max(0.001, (Date.now() - input.startedAtMs) / 1000);
  const speedBytesPerSecond = Math.round(input.uploadedBytes / elapsedSeconds);
  const remainingBytes = Math.max(0, input.totalBytes - input.uploadedBytes);
  const estimatedSecondsRemaining =
    speedBytesPerSecond > 0 ? Math.ceil(remainingBytes / speedBytesPerSecond) : null;

  return {
    percent,
    uploadedBytes: input.uploadedBytes,
    totalBytes: input.totalBytes,
    remainingBytes,
    speedBytesPerSecond,
    estimatedSecondsRemaining,
    label: input.label ?? "Envoi en cours…",
    stage: input.stage ?? "upload",
  };
}
