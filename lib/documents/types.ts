import {
  getFileExtension as getImportFileExtension,
  isAcceptedResourceFile as isImportAcceptedResourceFile,
} from "@/lib/import/accepted-formats";

export const DOCUMENT_STATUSES = ["uploaded", "analysed", "error"] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_TYPES = [
  "BO",
  "guide du maître",
  "manuel",
  "album",
  "séquence",
  "séance",
  "cahier journal",
  "programmation",
  "progression",
  "ressource personnelle",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const ACCEPTED_RESOURCE_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".pptx",
  ".xlsx",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
] as const;

export type AcceptedResourceExtension =
  (typeof ACCEPTED_RESOURCE_EXTENSIONS)[number];

export const FULLY_SUPPORTED_EXTENSIONS = [".txt", ".pdf", ".docx"] as const;

export const COMING_SOON_EXTENSIONS = [".pptx", ".xlsx"] as const;

export type FloraDocument = {
  id: string;
  created_at: string;
  title: string;
  original_filename: string;
  document_type: string;
  file_extension: string;
  file_size: number;
  storage_path: string;
  status: DocumentStatus;
  cycle: string;
  niveau: string;
  matiere: string;
  sous_matiere: string;
  methode: string;
  auteur: string;
  editeur: string;
  annee: string;
  resume: string;
  metadata: Record<string, unknown>;
};

export type DocumentChunk = {
  id: string;
  document_id: string;
  chunk_index: number;
  title: string;
  content: string;
  page_start: number | null;
  page_end: number | null;
  section_type: string;
  metadata: Record<string, unknown>;
};

export type DocumentTag = {
  id: string;
  document_id: string;
  tag: string;
};

export type DocumentCompetence = {
  id: string;
  document_id: string;
  competence: string;
  code_bo: string;
  matiere: string;
  sous_matiere: string;
  niveau: string;
};

export type PedagogicalEntity = {
  id: string;
  document_id: string;
  chunk_id: string | null;
  entity_type: string;
  label: string;
  content: string;
  source_text: string;
  confidence: number;
  metadata: Record<string, unknown>;
};

export type DocumentWithRelations = FloraDocument & {
  document_chunks: DocumentChunk[];
  document_tags: DocumentTag[];
  document_competences: DocumentCompetence[];
  pedagogical_entities: PedagogicalEntity[];
};

export type TextChunkDraft = {
  chunk_index: number;
  title: string;
  content: string;
  page_start: number | null;
  page_end: number | null;
  section_type: string;
  metadata: Record<string, unknown>;
};

export function getFileExtension(filename: string): string {
  return getImportFileExtension(filename);
}

export function isAcceptedResourceFile(filename: string, mimeType?: string): boolean {
  return isImportAcceptedResourceFile(filename, mimeType);
}

export function isFullySupportedExtension(extension: string): boolean {
  return FULLY_SUPPORTED_EXTENSIONS.includes(
    extension as (typeof FULLY_SUPPORTED_EXTENSIONS)[number],
  );
}

export function isComingSoonExtension(extension: string): boolean {
  return COMING_SOON_EXTENSIONS.includes(
    extension as (typeof COMING_SOON_EXTENSIONS)[number],
  );
}

export function formatDocumentTypeLabel(value: string): string {
  if (!value) return "Non défini";
  return value;
}

export function formatDocumentStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case "analysed":
      return "Analysé";
    case "uploaded":
      return "Importé";
    case "error":
      return "Erreur";
    default:
      return status;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export type DocumentSearchFilters = {
  query?: string;
  type?: string;
  matiere?: string;
  sousMatiere?: string;
  niveau?: string;
  cycle?: string;
  methode?: string;
};

export function formatDocumentDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
