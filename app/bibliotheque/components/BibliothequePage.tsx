"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import type { DocumentWithRelations } from "@/lib/documents/types";
import type { LibraryFilterOptions, UnifiedLibraryItem } from "@/lib/library/types";
import { colors } from "@/lib/theme";
import { BoDocumentDrawer } from "./BoDocumentDrawer";
import { DocumentDetails } from "./DocumentDetails";
import { DocumentSearch } from "./DocumentSearch";
import { LibraryFilters } from "./LibraryFilters";
import { LibraryItemCard } from "./LibraryItemCard";
import { ProgressUpload } from "./ProgressUpload";
import { UploadZone } from "./UploadZone";
import { initialLibraryFilterValues, type LibraryFilterValues } from "../types";
import {
  initialMultiUploadState,
  type MultiUploadState,
} from "../utils/import-manager";
import { importUnifiedFiles } from "../utils/unified-import";

export function BibliothequePage() {
  return (
    <Suspense fallback={<p className="text-sm font-light text-flora-text-subtle">Chargement…</p>}>
      <BibliothequePageContent />
    </Suspense>
  );
}

function BibliothequePageContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<UnifiedLibraryItem[]>([]);
  const [filterOptions, setFilterOptions] = useState<LibraryFilterOptions>({
    categories: ["Toutes"],
    disciplines: ["Toutes"],
    niveaux: ["Tous"],
    methodes: ["Toutes"],
    formats: ["Tous"],
  });
  const [selectedPedagogical, setSelectedPedagogical] = useState<DocumentWithRelations | null>(null);
  const [selectedBoId, setSelectedBoId] = useState<string | null>(
    searchParams.get("documentId"),
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<MultiUploadState>(initialMultiUploadState);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<LibraryFilterValues>(initialLibraryFilterValues);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const isUploading = uploadState.items.some(
    (item) => item.phase === "uploading" || item.phase === "analyzing",
  );

  const loadLibrary = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/bibliotheque/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: search,
          category: filters.category,
          discipline: filters.discipline,
          niveau: filters.niveau,
          methode: filters.methode,
          format: filters.format,
          sort: filters.sort,
        }),
      });

      const payload = (await response.json()) as {
        items?: UnifiedLibraryItem[];
        filterOptions?: LibraryFilterOptions;
        error?: string;
      };

      if (!response.ok) throw new Error(payload.error || "Impossible de charger la bibliothèque.");

      setItems(payload.items ?? []);
      if (payload.filterOptions) setFilterOptions(payload.filterOptions);

      const queryId = searchParams.get("documentId");
      if (queryId && payload.items?.some((item) => item.id === queryId && item.source === "bo_document")) {
        setSelectedBoId(queryId);
      }
    } catch (error) {
      setUploadState((current) => ({
        ...current,
        globalError:
          error instanceof Error ? error.message : "Impossible de charger la bibliothèque.",
      }));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, search, searchParams]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadLibrary();
    }, 250);
    return () => clearTimeout(timeout);
  }, [loadLibrary]);

  const runUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      await importUnifiedFiles(files, setUploadState, () => void loadLibrary());
      setSelectedFiles([]);
    },
    [loadLibrary],
  );

  const openItem = useCallback(async (item: UnifiedLibraryItem) => {
    if (item.source === "bo_document") {
      setSelectedBoId(item.id);
      setSelectedPedagogical(null);
      return;
    }

    const response = await fetch(`/api/documents/details?id=${item.id}`);
    const payload = (await response.json()) as {
      document?: DocumentWithRelations;
      error?: string;
    };

    if (!response.ok || !payload.document) {
      setUploadState((current) => ({
        ...current,
        globalError: payload.error || "Impossible d'afficher les détails du document.",
      }));
      return;
    }

    setSelectedPedagogical(payload.document);
    setSelectedBoId(null);
  }, []);

  const handleDeleteDocument = useCallback(async () => {
    if (!selectedPedagogical) return;
    setIsArchiving(true);
    try {
      const response = await fetch("/api/documents/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedPedagogical.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Impossible de supprimer le document.");
      setSelectedPedagogical(null);
      await loadLibrary();
    } catch (error) {
      setUploadState((current) => ({
        ...current,
        globalError:
          error instanceof Error ? error.message : "Impossible de supprimer le document.",
      }));
    } finally {
      setIsArchiving(false);
    }
  }, [loadLibrary, selectedPedagogical]);

  const boCount = useMemo(
    () => items.filter((item) => item.category === "Référentiel BO").length,
    [items],
  );

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="📚 Bibliothèque"
        subtitle="Centre documentaire unique de Flora — référentiels BO, guides, méthodes, programmations, progressions et ressources personnelles. Tous les modules s'appuient sur cette bibliothèque."
        meta={`${items.length} document${items.length > 1 ? "s" : ""}${boCount > 0 ? ` · ${boCount} référentiel${boCount > 1 ? "s" : ""} BO` : ""}`}
      />

      <UploadZone
        selectedFiles={selectedFiles}
        isDragging={isDragging}
        isUploading={isUploading}
        onDragStateChange={setIsDragging}
        onFilesSelected={(files) => {
          setSelectedFiles(files);
          void runUpload(files);
        }}
        onImportClick={() => {
          if (selectedFiles.length > 0) void runUpload(selectedFiles);
        }}
      />

      <ProgressUpload items={uploadState.items} />

      {(uploadState.globalMessage || uploadState.globalError) && (
        <p
          className={`rounded-2xl px-4 py-3 text-sm font-light ${
            uploadState.globalError ? "bg-rose-soft/35 text-[#b88989]" : "bg-sauge-light/25 text-sauge"
          }`}
        >
          {uploadState.globalError || uploadState.globalMessage}
        </p>
      )}

      <FloraCard padding="lg" accent="lavender">
        <DocumentSearch value={search} onChange={setSearch} />
      </FloraCard>

      <LibraryFilters
        values={filters}
        options={filterOptions}
        onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
      />

      <div className="flex flex-wrap gap-2">
        <FloraButton
          accent={viewMode === "cards" ? "sage" : "lavender"}
          variant={viewMode === "cards" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setViewMode("cards")}
        >
          Vue cartes
        </FloraButton>
        <FloraButton
          accent={viewMode === "table" ? "sage" : "lavender"}
          variant={viewMode === "table" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setViewMode("table")}
        >
          Vue tableau
        </FloraButton>
      </div>

      {selectedBoId ? (
        <BoDocumentDrawer
          documentId={selectedBoId}
          onClose={() => setSelectedBoId(null)}
          onUpdated={() => void loadLibrary()}
        />
      ) : null}

      {selectedPedagogical ? (
        <DocumentDetails
          document={selectedPedagogical}
          onClose={() => setSelectedPedagogical(null)}
          onArchive={handleDeleteDocument}
          isArchiving={isArchiving}
        />
      ) : null}

      {isLoading ? (
        <FloraCard padding="lg">
          <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Chargement de la bibliothèque…
          </p>
        </FloraCard>
      ) : items.length === 0 ? (
        <FloraCard padding="lg">
          <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Aucun document importé. Utilisez « Importer un document » pour commencer.
          </p>
        </FloraCard>
      ) : viewMode === "table" ? (
        <FloraCard padding="lg" accent="cream">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-flora-text-subtle">
                  <th className="pb-3 pr-4">Nom</th>
                  <th className="pb-3 pr-4">Catégorie</th>
                  <th className="pb-3 pr-4">Discipline</th>
                  <th className="pb-3 pr-4">Niveau</th>
                  <th className="pb-3 pr-4">Format</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={`${item.source}-${item.id}`}
                    className="cursor-pointer border-t border-white/50 hover:bg-white/30"
                    onClick={() => void openItem(item)}
                  >
                    <td className="py-3 pr-4 font-medium">{item.title}</td>
                    <td className="py-3 pr-4">{item.category}</td>
                    <td className="py-3 pr-4">{item.discipline || "—"}</td>
                    <td className="py-3 pr-4">{item.niveau || "—"}</td>
                    <td className="py-3 pr-4">{item.format}</td>
                    <td className="py-3 pr-4">{item.analysisStatus}</td>
                    <td className="py-3">
                      {new Intl.DateTimeFormat("fr-FR").format(new Date(item.createdAt))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FloraCard>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <LibraryItemCard
              key={`${item.source}-${item.id}`}
              item={item}
              onClick={() => void openItem(item)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
