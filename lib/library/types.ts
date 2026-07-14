import {
  LIBRARY_ACCEPTED_EXTENSIONS,
  isAcceptedForModule,
} from "@/lib/import/accepted-formats";

export const LIBRARY_CATEGORIES = [
  "Référentiel BO",
  "Guide enseignant",
  "Méthode",
  "Programmation",
  "Progression",
  "Séquence",
  "Cahier journal",
  "Ressource pédagogique",
  "Personnel",
] as const;

export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number];

export type LibraryItemSource = "document" | "bo_document";

export type LibrarySortKey = "name" | "date" | "size" | "updated";

export type LibraryViewMode = "cards" | "table";

export type UnifiedLibraryItem = {
  id: string;
  source: LibraryItemSource;
  title: string;
  originalFilename: string;
  category: LibraryCategory;
  discipline: string;
  niveau: string;
  methode: string;
  auteur: string;
  format: string;
  fileSize: number;
  status: string;
  analysisStatus: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isFavorite: boolean;
  isPinned: boolean;
  isActiveReferentiel: boolean;
  competenceCount: number;
  resume: string;
  cycle: string;
};

export type LibrarySearchFilters = {
  query?: string;
  category?: string;
  discipline?: string;
  niveau?: string;
  methode?: string;
  format?: string;
  sort?: LibrarySortKey;
};

export type LibraryFilterOptions = {
  categories: string[];
  disciplines: string[];
  niveaux: string[];
  methodes: string[];
  formats: string[];
};

export const UNIFIED_ACCEPTED_EXTENSIONS = LIBRARY_ACCEPTED_EXTENSIONS;

export function isUnifiedAcceptedFile(filename: string, mimeType?: string): boolean {
  return isAcceptedForModule("bibliotheque", filename, mimeType);
}
