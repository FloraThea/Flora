import { searchDocuments } from "@/lib/documents/document-service";
import type { FloraDocument } from "@/lib/documents/types";
import { listBoDocumentsWithCounts } from "@/lib/referentiel/bo-document-service";
import { BO_STATUS_LABELS, normalizeBoDocumentStatus } from "@/lib/referentiel/bo-status";
import { mapDocumentTypeToCategory } from "./category-mapper";
import type {
  LibraryFilterOptions,
  LibrarySearchFilters,
  UnifiedLibraryItem,
} from "./types";

function mapPedagogicalDocument(document: FloraDocument): UnifiedLibraryItem {
  const metadata = document.metadata ?? {};
  const tags = Array.isArray(metadata.tags)
    ? (metadata.tags as string[])
    : [];

  return {
    id: document.id,
    source: "document",
    title: document.title || document.original_filename,
    originalFilename: document.original_filename,
    category: mapDocumentTypeToCategory(document.document_type),
    discipline: document.matiere,
    niveau: document.niveau,
    methode: document.methode,
    auteur: document.auteur,
    format: document.file_extension.replace(".", "").toUpperCase() || "—",
    fileSize: document.file_size,
    status: document.status,
    analysisStatus:
      document.status === "analysed"
        ? "Analysé"
        : document.status === "error"
          ? "Erreur"
          : "Importé",
    tags,
    createdAt: document.created_at,
    updatedAt: String(metadata.updated_at ?? document.created_at),
    isFavorite: Boolean(metadata.favorite),
    isPinned: Boolean(metadata.pinned),
    isActiveReferentiel: false,
    competenceCount: 0,
    resume: document.resume,
    cycle: document.cycle,
  };
}

function mapBoDocument(
  document: Awaited<ReturnType<typeof listBoDocumentsWithCounts>>[number],
): UnifiedLibraryItem {
  const status = normalizeBoDocumentStatus(document.status);

  return {
    id: document.id,
    source: "bo_document",
    title: document.original_name ?? document.original_filename,
    originalFilename: document.original_filename,
    category: "Référentiel BO",
    discipline: document.matiere,
    niveau: document.niveau ?? "",
    methode: "",
    auteur: "",
    format: "PDF",
    fileSize: Number(document.metadata?.fileSize ?? 0),
    status,
    analysisStatus: BO_STATUS_LABELS[status] ?? status,
    tags: ["Référentiel BO"],
    createdAt: document.created_at,
    updatedAt: document.updated_at,
    isFavorite: Boolean(document.metadata?.favorite),
    isPinned: Boolean(document.metadata?.pinned),
    isActiveReferentiel: document.active_for_programmation,
    competenceCount: document.competence_count,
    resume: `Référentiel officiel — ${document.competence_count} compétence(s) extraite(s).`,
    cycle: document.cycle,
  };
}

function sortItems(items: UnifiedLibraryItem[], sort: LibrarySearchFilters["sort"]): UnifiedLibraryItem[] {
  const key = sort ?? "date";
  return [...items].sort((a, b) => {
    switch (key) {
      case "name":
        return a.title.localeCompare(b.title, "fr");
      case "size":
        return b.fileSize - a.fileSize;
      case "updated":
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      case "date":
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });
}

function filterItems(items: UnifiedLibraryItem[], filters: LibrarySearchFilters): UnifiedLibraryItem[] {
  const query = (filters.query ?? "").trim().toLowerCase();

  return items.filter((item) => {
    if (query) {
      const haystack = [
        item.title,
        item.originalFilename,
        item.discipline,
        item.niveau,
        item.methode,
        item.resume,
        item.category,
        ...item.tags,
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(query)) return false;
    }

    if (filters.category && filters.category !== "Toutes" && item.category !== filters.category) {
      return false;
    }
    if (filters.discipline && filters.discipline !== "Toutes" && item.discipline !== filters.discipline) {
      return false;
    }
    if (filters.niveau && filters.niveau !== "Tous" && item.niveau !== filters.niveau) {
      return false;
    }
    if (filters.methode && filters.methode !== "Toutes" && item.methode !== filters.methode) {
      return false;
    }
    if (filters.format && filters.format !== "Tous" && item.format !== filters.format) {
      return false;
    }

    return true;
  });
}

export function buildLibraryFilterOptions(items: UnifiedLibraryItem[]): LibraryFilterOptions {
  const unique = (values: string[]) => ["Toutes", ...Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"))];

  return {
    categories: unique(items.map((item) => item.category)),
    disciplines: unique(items.map((item) => item.discipline)),
    niveaux: ["Tous", ...Array.from(new Set(items.map((item) => item.niveau).filter(Boolean))).sort()],
    methodes: unique(items.map((item) => item.methode)),
    formats: ["Tous", ...Array.from(new Set(items.map((item) => item.format).filter(Boolean))).sort()],
  };
}

export async function listUnifiedLibrary(
  filters: LibrarySearchFilters = {},
): Promise<{ items: UnifiedLibraryItem[]; filterOptions: LibraryFilterOptions }> {
  const [documents, boDocuments] = await Promise.all([
    searchDocuments({
      query: filters.query,
      matiere: filters.discipline !== "Toutes" ? filters.discipline : undefined,
      niveau: filters.niveau !== "Tous" ? filters.niveau : undefined,
      methode: filters.methode !== "Toutes" ? filters.methode : undefined,
    }),
    listBoDocumentsWithCounts(),
  ]);

  const merged = [
    ...documents.map(mapPedagogicalDocument),
    ...boDocuments.map(mapBoDocument),
  ];

  const filtered = filterItems(merged, filters);
  const sorted = sortItems(filtered, filters.sort);

  return {
    items: sorted,
    filterOptions: buildLibraryFilterOptions(merged),
  };
}
