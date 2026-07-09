"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import { cn } from "@/lib/cn";
import { buildFilterOptions } from "@/lib/documents/document-service";
import type {
  DocumentSearchFilters,
  DocumentWithRelations,
  FloraDocument,
} from "@/lib/documents/types";
import { colors } from "@/lib/theme";
import { DocumentCard } from "./DocumentCard";
import { DocumentDetails } from "./DocumentDetails";
import { DocumentFilters } from "./DocumentFilters";
import { DocumentSearch } from "./DocumentSearch";
import { ProgressUpload } from "./ProgressUpload";
import { UploadZone } from "./UploadZone";
import { CentreRessourcesPanel } from "./CentreRessourcesPanel";
import {
  initialFilterValues,
  type FilterOptions,
  type FilterValues,
} from "../types";
import {
  importFilesWithProgress,
  initialMultiUploadState,
  type MultiUploadState,
} from "../utils/import-manager";

export function BibliothequePage() {
  return (
    <Suspense fallback={<p className="text-sm font-light text-flora-text-subtle">Chargement…</p>}>
      <BibliothequePageContent />
    </Suspense>
  );
}

function BibliothequePageContent() {
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "referentiels" ? "referentiels" : "pedagogique";
  const [activeTab, setActiveTab] = useState<"pedagogique" | "referentiels">(initialTab);
  const [documents, setDocuments] = useState<FloraDocument[]>([]);
  const [selectedDocument, setSelectedDocument] =
    useState<DocumentWithRelations | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadState, setUploadState] = useState<MultiUploadState>(initialMultiUploadState);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isArchiving, setIsArchiving] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterValues>(initialFilterValues);

  const isUploading = uploadState.items.some(
    (item) => item.phase === "uploading" || item.phase === "analyzing",
  );

  const loadDocuments = useCallback(async (searchFilters?: DocumentSearchFilters) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/documents/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchFilters ?? {}),
      });

      const payload = (await response.json()) as {
        documents?: FloraDocument[];
        error?: string;
        details?: {
          message?: string;
          code?: string;
          details?: string;
          hint?: string;
        };
      };

      console.info("[BibliothequePage] POST /api/documents/search", {
        ok: response.ok,
        status: response.status,
        filters: searchFilters,
        documentCount: payload.documents?.length ?? 0,
        error: payload.error,
        details: payload.details,
      });

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de charger la bibliothèque.");
      }

      setDocuments(payload.documents ?? []);
    } catch (error) {
      console.error("[BibliothequePage] Échec loadDocuments", {
        filters: searchFilters,
        error: error instanceof Error ? error.message : error,
      });
      setDocuments([]);
      setUploadState((current) => ({
        ...current,
        globalError:
          error instanceof Error
            ? error.message
            : "Impossible de charger la bibliothèque.",
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchPayload = useMemo<DocumentSearchFilters>(
    () => ({
      query: search,
      type: filters.type,
      matiere: filters.matiere,
      sousMatiere: filters.sousMatiere,
      niveau: filters.niveau,
      cycle: filters.cycle,
      methode: filters.methode,
    }),
    [search, filters],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      void loadDocuments(searchPayload);
    }, 250);

    return () => clearTimeout(timeout);
  }, [loadDocuments, searchPayload]);

  const filterOptions = useMemo<FilterOptions>(() => {
    const built = buildFilterOptions(documents);

    return {
      type: built.types,
      matiere: built.matieres,
      sousMatiere: built.sousMatieres,
      niveau: built.niveaux,
      cycle: built.cycles,
      methode: built.methodes,
    };
  }, [documents]);

  const runUpload = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      await importFilesWithProgress(files, setUploadState);
      setSelectedFiles([]);
      await loadDocuments(searchPayload);
    },
    [loadDocuments, searchPayload],
  );

  const handleFilesSelected = useCallback(
    (files: File[]) => {
      setSelectedFiles(files);
      void runUpload(files);
    },
    [runUpload],
  );

  const openDocumentDetails = useCallback(async (documentId: string) => {
    const response = await fetch(`/api/documents/details?id=${documentId}`);
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

    setSelectedDocument(payload.document);
  }, []);

  const handleArchiveDocument = useCallback(async () => {
    if (!selectedDocument) return;

    setIsArchiving(true);

    try {
      const response = await fetch("/api/documents/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedDocument.id }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Impossible de retirer le document.");
      }

      setSelectedDocument(null);
      await loadDocuments(searchPayload);
    } catch (error) {
      setUploadState((current) => ({
        ...current,
        globalError:
          error instanceof Error
            ? error.message
            : "Impossible de retirer le document.",
      }));
    } finally {
      setIsArchiving(false);
    }
  }, [loadDocuments, searchPayload, selectedDocument]);

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="Bibliothèque documentaire"
        subtitle="Centre de ressources : importez vos documents pédagogiques et les bulletins officiels, analysez-les avec Théa, validez les référentiels pour alimenter toute Flora."
        meta={
          activeTab === "pedagogique"
            ? `${documents.length} ressource${documents.length > 1 ? "s" : ""}`
            : "Référentiels BO"
        }
      />

      <div className="flex flex-wrap gap-2">
        <FloraButton
          accent={activeTab === "pedagogique" ? "sage" : "lavender"}
          variant={activeTab === "pedagogique" ? "primary" : "secondary"}
          onClick={() => setActiveTab("pedagogique")}
        >
          Ressources pédagogiques
        </FloraButton>
        <FloraButton
          accent={activeTab === "referentiels" ? "sage" : "lavender"}
          variant={activeTab === "referentiels" ? "primary" : "secondary"}
          onClick={() => setActiveTab("referentiels")}
        >
          Référentiels officiels (BO)
        </FloraButton>
      </div>

      {activeTab === "referentiels" ? (
        <CentreRessourcesPanel />
      ) : (
        <>
      <UploadZone
        selectedFiles={selectedFiles}
        isDragging={isDragging}
        isUploading={isUploading}
        onDragStateChange={setIsDragging}
        onFilesSelected={handleFilesSelected}
        onImportClick={() => {
          if (selectedFiles.length > 0) void runUpload(selectedFiles);
        }}
      />

      <ProgressUpload items={uploadState.items} />

      {(uploadState.globalMessage || uploadState.globalError) && (
        <p
          className={cn(
            "rounded-2xl px-4 py-3 text-sm font-light",
            uploadState.globalError && "bg-rose-soft/35 text-[#b88989]",
            uploadState.globalMessage && "bg-sauge-light/25 text-sauge",
          )}
        >
          {uploadState.globalError || uploadState.globalMessage}
        </p>
      )}

      <FloraCard padding="lg" accent="lavender">
        <DocumentSearch value={search} onChange={setSearch} />
      </FloraCard>

      <DocumentFilters
        values={filters}
        options={filterOptions}
        onChange={(key, value) =>
          setFilters((current) => ({ ...current, [key]: value }))
        }
      />

      {selectedDocument && (
        <DocumentDetails
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onArchive={handleArchiveDocument}
          isArchiving={isArchiving}
        />
      )}

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <FloraCard padding="lg">
            <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
              Chargement de la bibliothèque…
            </p>
          </FloraCard>
        ) : documents.length === 0 ? (
          <FloraCard padding="lg" className="lg:col-span-2 xl:col-span-3">
            <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
              Aucune ressource importée pour le moment.
            </p>
          </FloraCard>
        ) : (
          documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              onClick={() => void openDocumentDetails(document.id)}
            />
          ))
        )}
      </section>
        </>
      )}
    </div>
  );
}
