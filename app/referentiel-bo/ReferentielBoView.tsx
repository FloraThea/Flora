"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import { TheaGlow } from "@/components/ui/TheaGlow";
import { cn } from "@/lib/cn";
import { colors } from "@/lib/theme";
import {
  initialAnalysisSteps,
  resetAnalysisSteps,
  setAnalysisStepStatus,
} from "./lib/extractor";
import type {
  AnalysisStep,
  AnalysisStepId,
  AnalyzeDocumentResult,
  BoReference,
  DocumentStatus,
} from "./types";
import {
  ACCEPTED_EXTENSIONS,
  formatFileSize,
  formatFileType,
  getBoReferenceKey,
  isAcceptedFile,
  normalizeBoReference,
} from "./types";
import { ApiFetchDiagnosticError, fetchApiWithDiagnostics } from "@/lib/api/client-fetch";
import { logStructuredError, serializeError } from "@/lib/api/error-diagnostics";
import { supabase } from "@/lib/supabase";

const ANALYSE_ROUTE = "/api/referentiel-bo/analyse-bo";
const SAVE_ROUTE = "/api/referentiel-bo/save-bo";
const STATUS_ROUTE = "/api/referentiel-bo/status";
const ACTIVATE_ROUTE = "/api/referentiel-bo/activate";

type BoValidation = {
  totalCompetences: number;
  sectionsDetected: string[];
  sectionsMissing: string[];
  warnings: string[];
  probableMissing: string[];
};

type BoDocumentSummary = {
  id: string;
  original_filename: string;
  status: string;
  active_for_programmation: boolean;
  cycle: string;
  matiere: string;
  domaine: string;
  text_length: number;
  page_count: number | null;
  validation?: BoValidation;
};

type StorageHealth = {
  bucket: string;
  exists: boolean;
  message: string;
};

type BoStatusResponse = {
  document: BoDocumentSummary | null;
  competenceCount: number;
  sections: string[];
  storage?: StorageHealth;
};

type ImportBoResponse = {
  route: string;
  success: boolean;
  savedToLibrary?: boolean;
  fileName: string;
  documentId: string;
  documentStatus: string;
  activeForProgrammation: boolean;
  cycle: string;
  matiere: string;
  niveau?: string;
  extractionMethod: string;
  textLength: number;
  pageCount: number | null;
  preview: string;
  referencesCount: number;
  insertedCount: number;
  sectionsProcessed: string[];
  validation: BoValidation;
  competences: Array<Partial<BoReference> & { section?: string; sourceExcerpt?: string }>;
  pdfArchived?: boolean;
  storageBucket?: string | null;
  storageWarning?: string | null;
};

function mapSupabaseRowToBoReference(
  item: {
    id: string;
    cycle?: string | null;
    niveau?: string | null;
    discipline?: string | null;
    domaine?: string | null;
    sous_domaine?: string | null;
    competence?: string | null;
    sous_competence?: string | null;
    code?: string | null;
    section?: string | null;
    source_excerpt?: string | null;
    source_document?: string | null;
  },
  index: number,
): BoReference {
  return normalizeBoReference(
    {
      id: item.id,
      cycle: item.cycle ?? "",
      niveau: item.niveau ?? "",
      matiere: item.discipline ?? "",
      sousMatiere: item.domaine ?? item.section ?? "",
      sousSousMatiere: item.sous_domaine ?? "",
      competence: item.competence ?? "",
      sousCompetence: item.sous_competence ?? "",
      code: item.code ?? "",
      source: item.source_excerpt ?? item.source_document ?? "Supabase",
    },
    index,
  );
}

async function loadReferentielsForDocument(documentId: string | null): Promise<BoReference[]> {
  if (!documentId) return [];

  const { data, error } = await supabase
    .from("referentiels")
    .select("*")
    .eq("document_source_id", documentId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item, index) => mapSupabaseRowToBoReference(item, index));
}

const tableColumns: Array<{ key: keyof BoReference; label: string }> = [
  { key: "cycle", label: "Cycle" },
  { key: "niveau", label: "Niveau" },
  { key: "matiere", label: "Matière" },
  { key: "sousMatiere", label: "Sous-matière" },
  { key: "sousSousMatiere", label: "Sous-sous-matière" },
  { key: "competence", label: "Compétence" },
  { key: "sousCompetence", label: "Sous-compétence" },
  { key: "code", label: "Code" },
  { key: "source", label: "Source officielle" },
];

function stepAccent(status: AnalysisStep["status"]) {
  if (status === "done") return "sage" as const;
  if (status === "running") return "lavender" as const;
  return "cream" as const;
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/45 px-4 py-3">
      <p
        className="text-[11px] font-medium tracking-[0.12em] uppercase"
        style={{ color: colors.charcoal.label }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-sm font-light leading-snug"
        style={{ color: colors.charcoal.DEFAULT }}
      >
        {value}
      </p>
    </div>
  );
}

export function ReferentielBoView() {
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus>("empty");
  const [analysisSteps, setAnalysisSteps] =
    useState<AnalysisStep[]>(initialAnalysisSteps);
  const [analysisResult, setAnalysisResult] =
    useState<AnalyzeDocumentResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [referentiels, setReferentiels] = useState<BoReference[]>([]);
  const [isLoadingReferentiels, setIsLoadingReferentiels] = useState(true);
  const [boStatus, setBoStatus] = useState<BoStatusResponse | null>(null);
  const [isActivatingBo, setIsActivatingBo] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null);
  const [isSavedToLibrary, setIsSavedToLibrary] = useState(false);
  const [savedCompetenceCount, setSavedCompetenceCount] = useState(0);
  const [isSavingBo, setIsSavingBo] = useState(false);

  const refreshBoStatus = useCallback(async (documentId?: string | null) => {
    setIsLoadingReferentiels(true);
    try {
      const statusUrl =
        documentId && documentId.length > 0
          ? `${STATUS_ROUTE}?documentId=${encodeURIComponent(documentId)}`
          : STATUS_ROUTE;

      const status = await fetchApiWithDiagnostics<BoStatusResponse>(
        statusUrl,
        { method: "GET" },
        { label: "ReferentielBoView" },
      );

      setBoStatus(status);
      setStorageNotice(
        status.storage && !status.storage.exists ? status.storage.message : null,
      );

      const activeDocumentId = documentId ?? status.document?.id ?? null;
      const rows = await loadReferentielsForDocument(activeDocumentId);
      setReferentiels(rows);

      if (status.document?.status === "ready") {
        setIsSavedToLibrary(true);
        setSavedCompetenceCount(status.competenceCount);
        setPendingDocumentId(status.document.id);
        setDocumentStatus("validated");
      } else if (status.document?.status === "analyzed") {
        setIsSavedToLibrary(false);
        setPendingDocumentId(status.document.id);
        setDocumentStatus("analyzed");
      }

      console.info("[ReferentielBoView] Statut BO chargé", {
        documentId: activeDocumentId,
        competenceCount: status.competenceCount,
        sections: status.sections,
        active: status.document?.active_for_programmation ?? false,
        status: status.document?.status ?? null,
      });
    } catch (error) {
      logStructuredError("ReferentielBoView", "Echec chargement statut BO", {}, error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible de charger le référentiel BO importé.",
      );
    } finally {
      setIsLoadingReferentiels(false);
    }
  }, []);

  useEffect(() => {
    const documentId = searchParams.get("documentId");
    void refreshBoStatus(documentId);
  }, [refreshBoStatus, searchParams]);
  const resetAnalysisState = useCallback(() => {
    setAnalysisResult(null);
    setAnalysisSteps(resetAnalysisSteps());
  }, []);

  const handleFileSelection = useCallback(
    (file: File | null) => {
      if (!file) return;

      if (!isAcceptedFile(file)) {
        setErrorMessage(
          "Format non supporté. Utilisez un fichier PDF, DOCX ou TXT.",
        );
        setSelectedFile(null);
        setDocumentStatus("empty");
        return;
      }

      setErrorMessage(null);
      setSelectedFile(file);
      setDocumentStatus("ready");
      setPendingDocumentId(null);
      setIsSavedToLibrary(false);
      setSavedCompetenceCount(0);
      resetAnalysisState();
    },
    [resetAnalysisState],
  );
  
  const handleAnalyzeDocument = useCallback(async () => {
    if (!selectedFile) {
      setErrorMessage("Sélectionnez d'abord un document officiel à analyser.");
      return;
    }

    setErrorMessage(null);
    setDocumentStatus("analyzing");
    setAnalysisResult(null);
    setAnalysisSteps(resetAnalysisSteps());

    const markStep = (stepId: AnalysisStepId, status: AnalysisStep["status"]) => {
      setAnalysisSteps((current) => setAnalysisStepStatus(current, stepId, status));
    };

    try {
      markStep("reading", "running");

      console.info("[ReferentielBoView] Analyse BO démarrée", {
        route: ANALYSE_ROUTE,
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        size: selectedFile.size,
      });

      const formData = new FormData();
      formData.append("file", selectedFile);

      markStep("reading", "done");
      markStep("structure", "running");

      const data = await fetchApiWithDiagnostics<ImportBoResponse>(
        ANALYSE_ROUTE,
        { method: "POST", body: formData },
        {
          label: "ReferentielBoView",
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
        },
      );

      markStep("structure", "done");
      markStep("subjects", "running");
      markStep("subjects", "done");
      markStep("competencies", "running");
      markStep("competencies", "done");
      markStep("generation", "running");

      console.info("[ReferentielBoView] Analyse BO réussie", {
        route: ANALYSE_ROUTE,
        documentId: data.documentId,
        textLength: data.textLength,
        referencesCount: data.referencesCount,
        insertedCount: data.insertedCount,
        sectionsProcessed: data.sectionsProcessed,
        validation: data.validation,
        pdfArchived: data.pdfArchived,
        storageWarning: data.storageWarning,
      });

      setPendingDocumentId(data.documentId);
      setIsSavedToLibrary(Boolean(data.savedToLibrary));
      setSavedCompetenceCount(data.insertedCount);

      if (data.storageWarning) {
        setStorageNotice(data.storageWarning);
      }

      const normalizedRows = data.competences.map((row, index) =>
        normalizeBoReference(
          {
            id: `import-${index}`,
            cycle: row.cycle ?? data.cycle,
            niveau: row.niveau ?? "",
            matiere: row.matiere ?? data.matiere,
            sousMatiere: row.sousMatiere ?? row.section ?? "",
            sousSousMatiere: row.sousSousMatiere ?? "",
            competence: row.competence ?? "",
            sousCompetence: row.sousCompetence ?? "",
            code: row.code ?? "",
            source: row.sourceExcerpt ?? data.fileName,
          },
          index,
        ),
      );

      const result: AnalyzeDocumentResult = {
        fileName: selectedFile.name,
        fileType: formatFileType(selectedFile),
        rows: normalizedRows,
        preview: normalizedRows[0] ?? {
          id: "empty-preview",
          cycle: "",
          niveau: "",
          matiere: "",
          sousMatiere: "",
          sousSousMatiere: "",
          competence: "Aucune compétence extraite",
          sousCompetence: "",
          code: "",
          source: selectedFile.name,
        },
      };

      setAnalysisResult(result);
      markStep("generation", "done");
      setDocumentStatus("analyzed");
      await refreshBoStatus(data.documentId);
    } catch (error) {
      const diagnostics =
        error instanceof ApiFetchDiagnosticError ? error.diagnostics : undefined;

      logStructuredError(
        "ReferentielBoView",
        "Analyse BO échouée",
        {
          route: ANALYSE_ROUTE,
          apiRoute: ANALYSE_ROUTE,
          method: diagnostics?.method ?? "POST",
          url: diagnostics?.url,
          status: diagnostics?.status,
          statusText: diagnostics?.statusText,
          responseHeaders: diagnostics?.responseHeaders,
          rawBody: diagnostics?.rawBody,
          parsedBody: diagnostics?.parsedBody,
          requestPayload: diagnostics?.requestPayload,
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
        },
        error,
      );

      const displayMessage =
        error instanceof Error
          ? error.message
          : `L'import du référentiel BO a échoué: ${serializeError(error).message}`;

      setErrorMessage(displayMessage);
      setDocumentStatus("ready");
      setAnalysisSteps(resetAnalysisSteps());
    }
  }, [selectedFile, refreshBoStatus]);

  const handleSaveBo = useCallback(async () => {
    if (!pendingDocumentId) {
      setErrorMessage("Aucune analyse à enregistrer. Analysez d'abord un document BO.");
      return;
    }

    setIsSavingBo(true);
    setErrorMessage(null);

    try {
      const data = await fetchApiWithDiagnostics<{
        success: boolean;
        documentId: string;
        insertedCount: number;
        competenceCount: number;
        documentStatus: string;
      }>(
        SAVE_ROUTE,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: pendingDocumentId }),
        },
        { label: "ReferentielBoView" },
      );

      setIsSavedToLibrary(true);
      setSavedCompetenceCount(data.competenceCount ?? data.insertedCount);
      setDocumentStatus("validated");
      await refreshBoStatus(data.documentId);
    } catch (error) {
      logStructuredError("ReferentielBoView", "Enregistrement BO échoué", {}, error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Impossible d'enregistrer le référentiel dans la bibliothèque.",
      );
    } finally {
      setIsSavingBo(false);
    }
  }, [pendingDocumentId, refreshBoStatus]);

  const handleActivateBo = useCallback(async () => {
    const documentId = boStatus?.document?.id ?? pendingDocumentId;
    if (!documentId) return;

    setIsActivatingBo(true);
    setErrorMessage(null);

    try {
      await fetchApiWithDiagnostics(
        ACTIVATE_ROUTE,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        },
        { label: "ReferentielBoView" },
      );
      await refreshBoStatus(documentId);
    } catch (error) {
      logStructuredError("ReferentielBoView", "Activation BO échouée", {}, error);
      setErrorMessage(
        error instanceof Error ? error.message : "Impossible d'activer le référentiel BO.",
      );
    } finally {
      setIsActivatingBo(false);
    }
  }, [boStatus?.document?.id, pendingDocumentId, refreshBoStatus]);

  const rows = referentiels.length > 0 ? referentiels : (analysisResult?.rows ?? []);
  const preview = analysisResult?.preview ?? rows[0] ?? {
    id: "empty-preview",
    cycle: "",
    niveau: "",
    matiere: "",
    sousMatiere: "",
    sousSousMatiere: "",
    competence: isLoadingReferentiels
      ? "Chargement du référentiel…"
      : "Importez un document BO pour afficher une prévisualisation.",
    sousCompetence: "",
    code: "",
    source: "",
  };
  const showStructuredData =
    documentStatus === "analyzed" || documentStatus === "validated";
  const isAnalyzing = documentStatus === "analyzing";
  const canAnalyze = documentStatus === "ready" && !!selectedFile;

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="Référentiel BO"
        subtitle="Importez, vérifiez et structurez les programmes officiels."
      />

      <FloraCard padding="lg" accent="sage">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2
              className="font-serif text-2xl font-medium"
              style={{ color: colors.charcoal.DEFAULT }}
            >
              Référentiel BO importé
            </h2>
            <p
              className="mt-2 text-sm font-light"
              style={{ color: colors.charcoal.subtle }}
            >
              Document et compétences utilisés par Programmation, Progression, Séquences et Séances.
            </p>
          </div>

          {boStatus?.document && (
            <FloraBadge accent={boStatus.document.active_for_programmation ? "sage" : "lavender"}>
              {boStatus.document.active_for_programmation
                ? "Actif pour les programmations"
                : isSavedToLibrary
                  ? "Enregistré, non activé"
                  : "Analysé, non enregistré"}
            </FloraBadge>
          )}
        </div>

        {isLoadingReferentiels ? (
          <p className="mt-4 text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Chargement du référentiel importé…
          </p>
        ) : boStatus?.document ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PreviewField label="Document" value={boStatus.document.original_filename} />
            <PreviewField label="Statut" value={boStatus.document.status} />
            <PreviewField
              label="Compétences"
              value={`${boStatus.competenceCount} éléments`}
            />
            <PreviewField
              label="Sections détectées"
              value={boStatus.sections.length > 0 ? boStatus.sections.join(", ") : "Aucune"}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Aucun BO importé pour le moment. Importez un programme officiel pour alimenter Flora.
          </p>
        )}

        {storageNotice ? (
          <div className="mt-4 rounded-2xl border border-peach/40 bg-peach/20 px-4 py-3 text-sm font-light text-[#9a7b5c]">
            {storageNotice}
          </div>
        ) : null}

        {boStatus?.document?.validation?.warnings?.length ? (
          <div className="mt-4 rounded-2xl bg-rose-soft/25 px-4 py-3 text-sm font-light text-[#b88989]">
            {boStatus.document.validation.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        {documentStatus === "analyzed" && pendingDocumentId && !isSavedToLibrary && (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <FloraButton accent="sage" onClick={handleSaveBo} disabled={isSavingBo}>
              {isSavingBo ? "Enregistrement…" : "Valider et enregistrer dans la bibliothèque"}
            </FloraButton>
            <p className="text-sm font-light" style={{ color: colors.charcoal.subtle }}>
              {referentiels.length} compétence(s) prête(s) à être persistée en base.
            </p>
          </div>
        )}

        {isSavedToLibrary && (
          <div className="mt-6 rounded-2xl border border-sauge/30 bg-sauge-light/20 px-4 py-4">
            <p className="text-sm font-medium text-sauge">Référentiel enregistré</p>
            <p className="mt-1 text-sm font-light" style={{ color: colors.charcoal.subtle }}>
              {savedCompetenceCount || boStatus?.competenceCount || referentiels.length} compétence(s)
              enregistrée(s) dans la bibliothèque de données.
            </p>
          </div>
        )}

        {(boStatus?.document?.active_for_programmation === false && isSavedToLibrary) ||
        (boStatus?.document && !boStatus.document.active_for_programmation && boStatus.document.status === "ready") ? (
          <div className="mt-6">
            <FloraButton
              accent="sage"
              onClick={handleActivateBo}
              disabled={isActivatingBo || boStatus?.document?.status !== "ready"}
            >
              Utiliser pour les programmations
            </FloraButton>
          </div>
        ) : null}
      </FloraCard>

      <FloraCard padding="lg" accent="rose" className="border-rose-soft/50">
        <div className="flex flex-col gap-6">
          <div>
            <h2
              className="font-serif text-2xl font-medium"
              style={{ color: colors.charcoal.DEFAULT }}
            >
              Importer un document officiel
            </h2>
            <p
              className="mt-2 text-sm font-light leading-relaxed"
              style={{ color: colors.charcoal.subtle }}
            >
              Théa analysera le document pour repérer les cycles, niveaux,
              matières, compétences et sous-compétences.
            </p>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              handleFileSelection(event.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "rounded-[2rem] border border-dashed px-6 py-10 text-center transition-all duration-200",
              isDragging
                ? "border-rose-poudre/70 bg-rose-soft/30"
                : "border-rose-soft/60 bg-white/40",
            )}
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-lavande-light/40">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6 text-[#9a8ab0]"
                aria-hidden
              >
                <path
                  d="M12 16V8m0 0 4-4m-4 4 4 4M5 18h14a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <p
              className="mt-4 font-serif text-xl font-medium"
              style={{ color: colors.charcoal.DEFAULT }}
            >
              Déposez votre document ici
            </p>
            <p
              className="mt-2 text-sm font-light"
              style={{ color: colors.charcoal.subtle }}
            >
              Formats acceptés : PDF, DOCX, TXT
            </p>

            {!selectedFile && (
              <p
                className="mt-5 text-xs font-light"
                style={{ color: colors.charcoal.faint }}
              >
                Aucun fichier sélectionné
              </p>
            )}

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(event) =>
                handleFileSelection(event.target.files?.[0] ?? null)
              }
            />
          </div>

          {selectedFile && (
            <div className="rounded-3xl border border-white/70 bg-white/55 p-5 shadow-[0_2px_16px_rgba(0,0,0,0.025)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid gap-3 sm:grid-cols-3 sm:gap-6">
                  <div>
                    <p
                      className="text-[11px] font-medium tracking-[0.12em] uppercase"
                      style={{ color: colors.charcoal.label }}
                    >
                      Nom
                    </p>
                    <p
                      className="mt-1 text-sm font-light"
                      style={{ color: colors.charcoal.DEFAULT }}
                    >
                      {selectedFile.name}
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-[11px] font-medium tracking-[0.12em] uppercase"
                      style={{ color: colors.charcoal.label }}
                    >
                      Type
                    </p>
                    <p className="mt-1">
                      <FloraBadge accent="lavender" size="sm">
                        {formatFileType(selectedFile)}
                      </FloraBadge>
                    </p>
                  </div>
                  <div>
                    <p
                      className="text-[11px] font-medium tracking-[0.12em] uppercase"
                      style={{ color: colors.charcoal.label }}
                    >
                      Taille
                    </p>
                    <p
                      className="mt-1 text-sm font-light"
                      style={{ color: colors.charcoal.DEFAULT }}
                    >
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>

                {documentStatus === "ready" && (
                  <FloraBadge accent="sage">Document prêt à être analysé</FloraBadge>
                )}
                {documentStatus === "analyzing" && (
                  <FloraBadge accent="lavender">Analyse en cours…</FloraBadge>
                )}
                {showStructuredData && !isSavedToLibrary && (
                  <FloraBadge accent="lavender">Analyse terminée — enregistrement requis</FloraBadge>
                )}
                {showStructuredData && isSavedToLibrary && (
                  <FloraBadge accent="rose">Référentiel enregistré</FloraBadge>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <FloraButton
              accent="rose"
              onClick={() => inputRef.current?.click()}
              variant="secondary"
              disabled={isAnalyzing}
            >
              Choisir un fichier
            </FloraButton>
            <FloraButton
              accent="sage"
              onClick={handleAnalyzeDocument}
              disabled={!canAnalyze}
              leadingIcon={
                isAnalyzing ? (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-sauge/30 border-t-sauge" />
                ) : undefined
              }
            >
              Analyser avec Théa
            </FloraButton>
          </div>

          {errorMessage && (
            <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm font-light text-[#b88989]">
              {errorMessage}
            </p>
          )}
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="lavender">
        <div className="mb-6 flex items-start gap-4">
          <TheaGlow size="sm" pulse={isAnalyzing} title="" />
          <div>
            <h2
              className="font-serif text-2xl font-medium"
              style={{ color: colors.charcoal.DEFAULT }}
            >
              Analyse de Théa
            </h2>
            <p
              className="mt-2 text-sm font-light"
              style={{ color: colors.charcoal.subtle }}
            >
              Suivi des étapes de structuration automatique du référentiel.
            </p>
          </div>
        </div>

        <ol className="grid gap-3 lg:grid-cols-2">
          {analysisSteps.map((step, index) => (
            <li
              key={step.id}
              className={cn(
                "flex items-center gap-4 rounded-2xl border border-white/70 px-4 py-4 backdrop-blur-sm",
                step.status === "running" && "bg-lavande-light/35",
                step.status === "done" && "bg-sauge-light/20",
                step.status === "pending" && "bg-white/35",
              )}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/60 font-serif text-sm"
                style={{ color: colors.charcoal.DEFAULT }}
              >
                {index + 1}
              </span>
              <div className="flex-1">
                <p
                  className="text-sm font-light"
                  style={{ color: colors.charcoal.DEFAULT }}
                >
                  {step.label}
                </p>
              </div>
              <FloraBadge accent={stepAccent(step.status)} size="sm">
                {step.status === "done"
                  ? "Terminé"
                  : step.status === "running"
                    ? "En cours"
                    : "En attente"}
              </FloraBadge>
            </li>
          ))}
        </ol>
      </FloraCard>

      <FloraCard padding="lg" accent="sage">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2
              className="font-serif text-2xl font-medium"
              style={{ color: colors.charcoal.DEFAULT }}
            >
              Référentiel structuré
            </h2>
            <p
              className="mt-2 text-sm font-light"
              style={{ color: colors.charcoal.subtle }}
            >
              {showStructuredData
                ? `${rows.length} entrées extraites prêtes à être vérifiées.`
                : "Analysez un document pour générer le tableau structuré."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <FloraButton
              accent="lavender"
              variant="secondary"
              disabled={!showStructuredData}
              onClick={() => setDocumentStatus("analyzed")}
            >
              Vérifier l&apos;import
            </FloraButton>
            <FloraButton
              accent="sage"
              disabled={!showStructuredData}
              onClick={() => setDocumentStatus("validated")}
            >
              Valider dans le référentiel
            </FloraButton>
            <FloraButton
              accent="lavender"
              variant="outline"
              disabled={!analysisResult}
              leadingIcon={
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className="h-4 w-4 text-[#9a8ab0]"
                  aria-hidden
                >
                  <path
                    d="M4 4h8l4 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M12 4v4h4M7 10h6M7 13h4"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              }
            >
              Voir le document officiel
            </FloraButton>
          </div>
        </div>

        {documentStatus === "validated" && (
          <p className="mb-4 rounded-2xl bg-sauge-light/25 px-4 py-3 text-sm font-light text-sauge">
            Référentiel validé. Les entrées peuvent être enregistrées dans Flora.
          </p>
        )}

        <div className="overflow-x-auto rounded-3xl border border-white/70 bg-white/45">
          <table className="min-w-[1200px] w-full border-collapse">
            <thead>
              <tr className="border-b border-white/70 bg-white/50">
                {tableColumns.map((column) => (
                  <th
                    key={`header-${String(column.key)}`}
                    className="px-4 py-4 text-left text-[11px] font-medium tracking-[0.12em] uppercase"
                    style={{ color: colors.charcoal.label }}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showStructuredData ? (
                rows.map((row, rowIndex) => {
                  const rowKey = getBoReferenceKey(row, rowIndex);

                  return (
                  <tr
                    key={rowKey}
                    className="border-b border-white/60 transition-colors duration-200 hover:bg-rose-soft/15"
                  >
                    {tableColumns.map((column) => (
                      <td
                        key={`${rowKey}-${String(column.key)}`}
                        className="px-4 py-4 align-top text-sm font-light leading-snug"
                        style={{ color: colors.charcoal.muted }}
                      >
                        {column.key === "code" ? (
                          <FloraBadge accent="lavender" size="sm">
                            {row[column.key]}
                          </FloraBadge>
                        ) : (
                          row[column.key]
                        )}
                      </td>
                    ))}
                  </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={tableColumns.length}
                    className="px-4 py-10 text-center text-sm font-light"
                    style={{ color: colors.charcoal.faint }}
                  >
                    Le tableau se remplira automatiquement après l&apos;analyse.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </FloraCard>

      <FloraCard padding="lg" accent="peach">
        <h2
          className="mb-4 font-serif text-2xl font-medium"
          style={{ color: colors.charcoal.DEFAULT }}
        >
          Prévisualisation
        </h2>
        <p
          className="mb-6 text-sm font-light"
          style={{ color: colors.charcoal.subtle }}
        >
          Exemple de fiche structurée extraite par Théa.
        </p>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <PreviewField label="Cycle" value={preview.cycle} />
          <PreviewField label="Niveau" value={preview.niveau} />
          <PreviewField label="Matière" value={preview.matiere} />
          <PreviewField label="Sous-matière" value={preview.sousMatiere} />
          <PreviewField
            label="Sous-sous-matière"
            value={preview.sousSousMatiere}
          />
          <PreviewField label="Compétence" value={preview.competence} />
          <PreviewField label="Sous-compétence" value={preview.sousCompetence} />
          <PreviewField label="Code" value={preview.code} />
          <PreviewField label="Source officielle" value={preview.source} />
        </div>
      </FloraCard>
    </div>
  );
}