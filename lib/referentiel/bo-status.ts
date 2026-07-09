import type { BoDocumentStatus } from "./bo-types";

export const BO_STATUS_LABELS: Record<BoDocumentStatus, string> = {
  UPLOADED: "Fichier importé",
  TEXT_EXTRACTED: "Texte extrait",
  ANALYZING: "Analyse en cours",
  ANALYZED: "Analysé par Théa",
  VALIDATED: "Validé",
  READY: "Prêt à l'emploi",
  ERROR: "Erreur",
};

export function normalizeBoDocumentStatus(status: string): BoDocumentStatus {
  const upper = status.toUpperCase();
  const map: Record<string, BoDocumentStatus> = {
    UPLOADED: "UPLOADED",
    IMPORTED: "UPLOADED",
    TEXT_EXTRACTED: "TEXT_EXTRACTED",
    ANALYZING: "ANALYZING",
    ANALYZED: "ANALYZED",
    VALIDATED: "VALIDATED",
    READY: "READY",
    ERROR: "ERROR",
  };
  return map[upper] ?? "UPLOADED";
}

export function isBoReadyForProgrammation(status: string): boolean {
  const normalized = normalizeBoDocumentStatus(status);
  return normalized === "READY" || normalized === "VALIDATED";
}

export function canAnalyzeBo(status: string): boolean {
  const normalized = normalizeBoDocumentStatus(status);
  return ["TEXT_EXTRACTED", "ANALYZED", "ERROR", "VALIDATED"].includes(normalized);
}

export function canValidateBo(status: string): boolean {
  return normalizeBoDocumentStatus(status) === "ANALYZED";
}
