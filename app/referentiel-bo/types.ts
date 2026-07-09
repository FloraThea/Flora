import { getListKey } from "@/lib/list-keys";

export type AnalysisStepId =
  | "reading"
  | "structure"
  | "subjects"
  | "competencies"
  | "generation";

export type AnalysisStepStatus = "pending" | "running" | "done";

export type AnalysisStep = {
  id: AnalysisStepId;
  label: string;
  status: AnalysisStepStatus;
};

/** Structure officielle d'une entrée du référentiel BO. */
export type BoReference = {
  id: string;
  cycle: string;
  niveau: string;
  matiere: string;
  sousMatiere: string;
  sousSousMatiere: string;
  competence: string;
  sousCompetence: string;
  code: string;
  source: string;
};

export type AnalyzeDocumentResult = {
  fileName: string;
  fileType: string;
  rows: BoReference[];
  preview: BoReference;
};

export type DocumentStatus =
  | "empty"
  | "ready"
  | "analyzing"
  | "analyzed"
  | "validated";

export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;

export function isAcceptedFile(file: File): boolean {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(
    extension as (typeof ACCEPTED_EXTENSIONS)[number],
  );
}

export function formatFileType(file: File): string {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

  if (file.type === "application/pdf" || extension === ".pdf") return "PDF";
  if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === ".docx"
  ) {
    return "DOCX";
  }
  if (file.type === "text/plain" || extension === ".txt") return "TXT";
  return extension.replace(".", "").toUpperCase() || "Inconnu";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function getBoReferenceKey(row: BoReference, index: number): string {
  return getListKey(
    row.id,
    [row.code, row.niveau, row.matiere, row.sousMatiere, row.competence, row.sousCompetence],
    index,
    "bo-reference",
  );
}

export function normalizeBoReference(
  row: Partial<BoReference>,
  index: number,
): BoReference {
  const normalized: BoReference = {
    id: row.id ?? "",
    cycle: row.cycle ?? "",
    niveau: row.niveau ?? "",
    matiere: row.matiere ?? "",
    sousMatiere: row.sousMatiere ?? "",
    sousSousMatiere: row.sousSousMatiere ?? "",
    competence: row.competence ?? "",
    sousCompetence: row.sousCompetence ?? "",
    code: row.code ?? "",
    source: row.source ?? "",
  };

  if (!normalized.id) {
    normalized.id = getBoReferenceKey(normalized, index);
  }

  return normalized;
}
