/**
 * Configuration centralisée des formats d'import Flora.
 * Tous les composants d'import doivent utiliser ces constantes.
 */

export const SUPPORTED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png"] as const;

export type SupportedImageExtension = (typeof SUPPORTED_IMAGE_EXTENSIONS)[number];

export const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png"] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export const DOCUMENT_IMPORT_ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "text/csv": [".csv"],
  "text/plain": [".txt"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
} as const;

export const SPREADSHEET_EXTENSIONS = [".xlsx", ".xls", ".csv"] as const;

export const DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".pptx",
  ".xlsx",
  ".xls",
  ".csv",
  ".txt",
] as const;

/** Bibliothèque : tous les formats pédagogiques courants + images obligatoires. */
export const LIBRARY_ACCEPTED_EXTENSIONS = [
  ...DOCUMENT_EXTENSIONS,
  ...SUPPORTED_IMAGE_EXTENSIONS,
] as const;

/** Formats acceptés par le pipeline documentaire (upload chunké + analyse). */
export const RESOURCE_ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".txt",
  ...SUPPORTED_IMAGE_EXTENSIONS,
] as const;

export type ResourceAcceptedExtension = (typeof RESOURCE_ACCEPTED_EXTENSIONS)[number];

export type ImportModule =
  | "bibliotheque"
  | "referentiel_bo"
  | "programmation"
  | "progression"
  | "sequence"
  | "seance"
  | "cahier_journal"
  | "rituel"
  | "emploi_du_temps"
  | "ressource"
  | "guide_pedagogique"
  | "agenda_108h";

const MODULE_EXTENSION_SETS: Record<ImportModule, readonly string[]> = {
  bibliotheque: LIBRARY_ACCEPTED_EXTENSIONS,
  referentiel_bo: [".pdf", ".docx", ".doc", ".txt", ...SUPPORTED_IMAGE_EXTENSIONS],
  programmation: [
    ".pdf",
    ".csv",
    ".txt",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ...SUPPORTED_IMAGE_EXTENSIONS,
  ],
  progression: [".xlsx", ".xls", ".pdf", ...SUPPORTED_IMAGE_EXTENSIONS],
  sequence: [".xlsx", ".xls", ".pdf", ...SUPPORTED_IMAGE_EXTENSIONS],
  seance: [".xlsx", ".xls", ".pdf", ...SUPPORTED_IMAGE_EXTENSIONS],
  cahier_journal: [".pdf", ".docx", ...SUPPORTED_IMAGE_EXTENSIONS],
  rituel: [".pdf", ...SUPPORTED_IMAGE_EXTENSIONS],
  emploi_du_temps: [".xlsx", ".xls", ".csv", ...SUPPORTED_IMAGE_EXTENSIONS],
  ressource: LIBRARY_ACCEPTED_EXTENSIONS,
  guide_pedagogique: [".pdf", ".docx", ...SUPPORTED_IMAGE_EXTENSIONS],
  agenda_108h: [".pdf", ".docx", ".doc", ...SUPPORTED_IMAGE_EXTENSIONS],
};

const MODULE_HELP_LABELS: Record<ImportModule, string> = {
  bibliotheque: "JPG, JPEG, PNG, PDF, DOCX, XLSX, CSV, PPTX et TXT",
  referentiel_bo: "JPG, JPEG, PNG, PDF, DOCX et TXT",
  programmation: "JPG, JPEG, PNG, PDF, DOCX, XLSX, CSV et TXT",
  progression: "JPG, JPEG, PNG, PDF et Excel (.xlsx, .xls)",
  sequence: "JPG, JPEG, PNG, PDF et Excel (.xlsx, .xls)",
  seance: "JPG, JPEG, PNG, PDF et Excel (.xlsx, .xls)",
  cahier_journal: "JPG, JPEG, PNG, PDF et DOCX",
  rituel: "JPG, JPEG, PNG et PDF",
  emploi_du_temps: "JPG, JPEG, PNG, Excel (.xlsx, .xls) et CSV",
  ressource: "JPG, JPEG, PNG, PDF, DOCX, XLSX, CSV, PPTX et TXT",
  guide_pedagogique: "JPG, JPEG, PNG, PDF et DOCX",
  agenda_108h: "JPG, JPEG, PNG, PDF, DOCX et DOC",
};

export function getFileExtension(filename: string): string {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex === -1) return "";
  return filename.slice(dotIndex).toLowerCase();
}

export function isSupportedImageFile(fileName: string, mimeType?: string): boolean {
  const ext = getFileExtension(fileName);
  if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext as SupportedImageExtension)) return true;
  if (mimeType && SUPPORTED_IMAGE_MIME_TYPES.includes(mimeType as SupportedImageMimeType)) {
    return true;
  }
  return mimeType?.startsWith("image/") ?? false;
}

export function isAcceptedForModule(
  module: ImportModule,
  fileName: string,
  mimeType?: string,
): boolean {
  const ext = getFileExtension(fileName);
  const allowed = MODULE_EXTENSION_SETS[module];
  if (allowed.includes(ext)) return true;
  if (isSupportedImageFile(fileName, mimeType) && allowed.some((item) => SUPPORTED_IMAGE_EXTENSIONS.includes(item as SupportedImageExtension))) {
    return true;
  }
  return false;
}

export function isAcceptedResourceFile(fileName: string, mimeType?: string): boolean {
  const ext = getFileExtension(fileName);
  if (RESOURCE_ACCEPTED_EXTENSIONS.includes(ext as ResourceAcceptedExtension)) return true;
  return isSupportedImageFile(fileName, mimeType);
}

export function buildAcceptAttribute(extensions: readonly string[]): string {
  return [...new Set(extensions)].join(",");
}

export function getModuleAcceptAttribute(module: ImportModule): string {
  return buildAcceptAttribute(MODULE_EXTENSION_SETS[module]);
}

export function getFormatsAcceptesLabel(module: ImportModule): string {
  return `Formats acceptés : ${MODULE_HELP_LABELS[module]}`;
}

export function validateImportFile(
  module: ImportModule,
  file: Pick<File, "name" | "type" | "size">,
  maxSizeBytes: number,
): { ok: true } | { ok: false; error: string } {
  if (!isAcceptedForModule(module, file.name, file.type)) {
    return {
      ok: false,
      error: `Format non supporté (${file.name}). ${getFormatsAcceptesLabel(module)}.`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, error: "Le fichier est vide." };
  }
  if (file.size > maxSizeBytes) {
    return { ok: false, error: `Fichier trop volumineux (max ${Math.round(maxSizeBytes / (1024 * 1024))} Mo).` };
  }
  return { ok: true };
}
