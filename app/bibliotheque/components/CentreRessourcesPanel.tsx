"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { TheaGlow } from "@/components/ui/TheaGlow";
import { ApiFetchDiagnosticError, fetchApiWithDiagnostics } from "@/lib/api/client-fetch";
import { BO_STATUS_LABELS, canAnalyzeBo, canValidateBo, normalizeBoDocumentStatus } from "@/lib/referentiel/bo-status";
import { colors } from "@/lib/theme";
import { ACCEPTED_EXTENSIONS, isAcceptedFile } from "@/app/referentiel-bo/types";

type CentreDocument = {
  id: string;
  original_filename: string;
  matiere: string;
  cycle: string;
  niveau: string;
  status: string;
  error_message?: string;
  active_for_programmation: boolean;
  competence_count: number;
  text_length: number;
  page_count: number | null;
  created_at: string;
  sections: string[];
  validation?: {
    totalCompetences?: number;
    sectionsMissing?: string[];
    warnings?: string[];
  };
};

type CompetencePreview = {
  id: string;
  discipline: string | null;
  domaine: string | null;
  competence: string | null;
  section: string | null;
  source_excerpt: string | null;
};

const LIST_ROUTE = "/api/centre-ressources/list";
const IMPORT_ROUTE = "/api/centre-ressources/import";
const ANALYZE_ROUTE = "/api/centre-ressources/analyze";
const VALIDATE_ROUTE = "/api/centre-ressources/validate";
const ACTIVATE_ROUTE = "/api/centre-ressources/activate";
const DELETE_ROUTE = "/api/centre-ressources/delete";

function statusAccent(status: string): "sage" | "lavender" | "peach" | "cream" | "rose" {
  const normalized = normalizeBoDocumentStatus(status);
  if (normalized === "READY" || normalized === "VALIDATED") return "sage";
  if (normalized === "ANALYZED" || normalized === "ANALYZING") return "lavender";
  if (normalized === "ERROR") return "peach";
  if (normalized === "TEXT_EXTRACTED") return "cream";
  return "rose";
}

export function CentreRessourcesPanel() {
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<CentreDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [competences, setCompetences] = useState<CompetencePreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const selected = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? null,
    [documents, selectedId],
  );

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = await fetchApiWithDiagnostics<{
        documents: CentreDocument[];
        storage?: { message?: string };
      }>(LIST_ROUTE, { method: "GET" }, { label: "CentreRessources" });

      setDocuments(payload.documents ?? []);
      setStorageWarning(payload.storage?.message ?? null);

      const queryId = searchParams.get("documentId");
      if (queryId && payload.documents?.some((doc) => doc.id === queryId)) {
        setSelectedId(queryId);
      }
    } catch (loadError) {
      setDocuments([]);
      setError(
        loadError instanceof Error ? loadError.message : "Impossible de charger les documents.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  const loadCompetences = useCallback(async (documentId: string) => {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase
      .from("referentiels")
      .select("id, discipline, domaine, competence, section, source_excerpt")
      .eq("document_source_id", documentId)
      .order("sort_order", { ascending: true })
      .limit(80);

    setCompetences((data ?? []) as CompetencePreview[]);
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (selectedId) {
      void loadCompetences(selectedId);
    } else {
      setCompetences([]);
    }
  }, [selectedId, loadCompetences]);

  async function handleImport(file: File) {
    if (!isAcceptedFile(file)) {
      setError("Format non accepté. Utilisez un PDF ou un document texte.");
      return;
    }

    setBusyAction("import");
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(IMPORT_ROUTE, { method: "POST", body: formData });
      const payload = (await response.json()) as {
        documentId?: string;
        error?: string;
        storageWarning?: string | null;
      };

      if (!response.ok) {
        throw new Error(payload.error || "Import impossible.");
      }

      setMessage("Document importé. Texte extrait et sauvegardé.");
      if (payload.storageWarning) setStorageWarning(payload.storageWarning);
      await loadDocuments();
      if (payload.documentId) setSelectedId(payload.documentId);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import impossible.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAnalyze(documentId: string) {
    setBusyAction(`analyze-${documentId}`);
    setError(null);
    setMessage(null);

    try {
      await fetchApiWithDiagnostics(
        ANALYZE_ROUTE,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        },
        { label: "CentreRessources" },
      );
      setMessage("Analyse Théa terminée. Vérifiez les compétences extraites.");
      await loadDocuments();
      setSelectedId(documentId);
      await loadCompetences(documentId);
    } catch (analyzeError) {
      const text =
        analyzeError instanceof ApiFetchDiagnosticError
          ? analyzeError.message
          : analyzeError instanceof Error
            ? analyzeError.message
            : "Analyse impossible.";
      setError(text);
      await loadDocuments();
    } finally {
      setBusyAction(null);
    }
  }

  async function handleValidate(documentId: string) {
    setBusyAction(`validate-${documentId}`);
    setError(null);
    try {
      await fetchApiWithDiagnostics(
        VALIDATE_ROUTE,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        },
        { label: "CentreRessources" },
      );
      setMessage("Référentiel validé et prêt à l'emploi.");
      await loadDocuments();
    } catch (validateError) {
      setError(validateError instanceof Error ? validateError.message : "Validation impossible.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleActivate(documentId: string) {
    setBusyAction(`activate-${documentId}`);
    setError(null);
    try {
      await fetchApiWithDiagnostics(
        ACTIVATE_ROUTE,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        },
        { label: "CentreRessources" },
      );
      setMessage("Référentiel activé pour les programmations.");
      await loadDocuments();
    } catch (activateError) {
      setError(activateError instanceof Error ? activateError.message : "Activation impossible.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete(documentId: string) {
    if (!window.confirm("Supprimer ce document et ses compétences extraites ?")) {
      return;
    }

    setBusyAction(`delete-${documentId}`);
    setError(null);
    try {
      await fetchApiWithDiagnostics(
        DELETE_ROUTE,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        },
        { label: "CentreRessources" },
      );
      setMessage("Document supprimé.");
      if (selectedId === documentId) setSelectedId(null);
      await loadDocuments();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FloraCard padding="lg" accent="lavender">
        <div className="flex items-start gap-4">
          <TheaGlow />
          <div>
            <h2 className="font-serif text-2xl font-medium" style={{ color: colors.charcoal.DEFAULT }}>
              Référentiels officiels (BO)
            </h2>
            <p className="mt-2 text-sm font-light" style={{ color: colors.charcoal.subtle }}>
              Importez un BO, extrayez le texte, analysez avec Théa, validez puis utilisez les
              compétences dans Programmation, Progression, Séquences et Cahier journal.
            </p>
          </div>
        </div>

        {storageWarning ? (
          <p className="mt-4 rounded-2xl bg-peche-light/35 px-4 py-3 text-sm font-light text-[#c49a88]">
            {storageWarning}
          </p>
        ) : null}

        <div
          className={`mt-6 rounded-3xl border border-dashed px-6 py-10 text-center transition ${
            isDragging ? "border-sauge bg-sauge-light/20" : "border-white/70 bg-white/35"
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void handleImport(file);
          }}
        >
          <p className="text-sm font-light" style={{ color: colors.charcoal.subtle }}>
            Déposez un PDF officiel (Français, Maths, …) ou cliquez pour importer.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <FloraButton
            accent="lavender"
            className="mt-4"
            onClick={() => fileInputRef.current?.click()}
            disabled={busyAction === "import"}
          >
            {busyAction === "import" ? "Import en cours…" : "Importer un document officiel"}
          </FloraButton>
        </div>
      </FloraCard>

      {message ? (
        <p className="rounded-2xl bg-sauge-light/25 px-4 py-3 text-sm font-light text-sauge">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm font-light text-[#b88989]">
          {error}
        </p>
      ) : null}

      <FloraCard padding="lg" accent="cream">
        <h3 className="font-serif text-xl font-medium">Documents importés</h3>

        {isLoading ? (
          <p className="mt-4 text-sm font-light text-flora-text-subtle">Chargement…</p>
        ) : documents.length === 0 ? (
          <p className="mt-4 text-sm font-light text-flora-text-subtle">
            Aucun référentiel importé. Commencez par importer un bulletin officiel.
          </p>
        ) : (
          <div className="mt-4 grid gap-3">
            {documents.map((document) => {
              const normalized = normalizeBoDocumentStatus(document.status);
              const isSelected = document.id === selectedId;

              return (
                <article
                  key={document.id}
                  className={`rounded-2xl border px-4 py-4 ${
                    isSelected ? "border-sauge bg-sauge-light/15" : "border-white/70 bg-white/40"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => setSelectedId(document.id)}
                    >
                      <p className="text-sm font-medium">{document.original_filename}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <FloraBadge accent="lavender" size="sm">
                          {document.matiere || "Matière"}
                        </FloraBadge>
                        <FloraBadge accent="cream" size="sm">
                          {document.cycle || "Cycle"}
                        </FloraBadge>
                        <FloraBadge accent={statusAccent(document.status)} size="sm">
                          {BO_STATUS_LABELS[normalized] ?? document.status}
                        </FloraBadge>
                        {document.active_for_programmation ? (
                          <FloraBadge accent="sage" size="sm">
                            Actif
                          </FloraBadge>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs font-light text-flora-text-subtle">
                        {document.competence_count} compétence(s) · {document.text_length} caractères
                        {document.page_count ? ` · ${document.page_count} p.` : ""} ·{" "}
                        {new Date(document.created_at).toLocaleDateString("fr-FR")}
                      </p>
                      {document.error_message ? (
                        <p className="mt-2 text-xs font-light text-[#b88989]">
                          {document.error_message}
                        </p>
                      ) : null}
                    </button>

                    <div className="flex flex-wrap gap-2">
                      {canAnalyzeBo(document.status) ? (
                        <FloraButton
                          accent="lavender"
                          size="sm"
                          variant="secondary"
                          disabled={busyAction === `analyze-${document.id}`}
                          onClick={() => void handleAnalyze(document.id)}
                        >
                          {normalized === "ANALYZED" || normalized === "ERROR"
                            ? "Relancer l'analyse"
                            : "Analyser avec Théa"}
                        </FloraButton>
                      ) : null}
                      {canValidateBo(document.status) ? (
                        <FloraButton
                          accent="sage"
                          size="sm"
                          disabled={busyAction === `validate-${document.id}`}
                          onClick={() => void handleValidate(document.id)}
                        >
                          Valider le référentiel
                        </FloraButton>
                      ) : null}
                      {normalized === "READY" && !document.active_for_programmation ? (
                        <FloraButton
                          accent="sage"
                          size="sm"
                          disabled={busyAction === `activate-${document.id}`}
                          onClick={() => void handleActivate(document.id)}
                        >
                          Utiliser pour les programmations
                        </FloraButton>
                      ) : null}
                      <FloraButton
                        accent="rose"
                        size="sm"
                        variant="secondary"
                        disabled={busyAction === `delete-${document.id}`}
                        onClick={() => void handleDelete(document.id)}
                      >
                        Supprimer
                      </FloraButton>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </FloraCard>

      {selected ? (
        <FloraCard padding="lg" accent="sage">
          <h3 className="font-serif text-xl font-medium">{selected.original_filename}</h3>
          <p className="mt-2 text-sm font-light text-flora-text-subtle">
            {selected.competence_count} compétence(s) · Sections :{" "}
            {selected.sections.length > 0 ? selected.sections.join(", ") : "—"}
          </p>

          {selected.validation?.warnings?.length ? (
            <ul className="mt-4 space-y-1 text-sm font-light text-[#c49a88]">
              {selected.validation.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          {selected.validation?.sectionsMissing?.length ? (
            <p className="mt-2 text-sm font-light text-[#b88989]">
              Sections manquantes : {selected.validation.sectionsMissing.join(", ")}
            </p>
          ) : null}

          {competences.length > 0 ? (
            <div className="mt-6 max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-flora-text-subtle">
                    <th className="pb-2 pr-2">Section</th>
                    <th className="pb-2 pr-2">Compétence</th>
                    <th className="pb-2">Extrait</th>
                  </tr>
                </thead>
                <tbody>
                  {competences.map((row) => (
                    <tr key={row.id} className="border-t border-white/50">
                      <td className="py-2 pr-2 align-top">{row.section}</td>
                      <td className="py-2 pr-2 align-top">{row.competence}</td>
                      <td className="py-2 align-top font-light text-flora-text-subtle">
                        {row.source_excerpt}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 text-sm font-light text-flora-text-subtle">
              Aucune compétence enregistrée. Lancez l&apos;analyse Théa.
            </p>
          )}
        </FloraCard>
      ) : null}
    </div>
  );
}
