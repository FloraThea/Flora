"use client";

import { useCallback, useEffect, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { ApiFetchDiagnosticError, fetchApiWithDiagnostics } from "@/lib/api/client-fetch";
import { BO_STATUS_LABELS, canAnalyzeBo, canValidateBo, normalizeBoDocumentStatus } from "@/lib/referentiel/bo-status";

type BoDocumentDrawerProps = {
  documentId: string;
  onClose: () => void;
  onUpdated: () => void;
};

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
    warnings?: string[];
    sectionsMissing?: string[];
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

export function BoDocumentDrawer({ documentId, onClose, onUpdated }: BoDocumentDrawerProps) {
  const [document, setDocument] = useState<CentreDocument | null>(null);
  const [competences, setCompetences] = useState<CompetencePreview[]>([]);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDocument = useCallback(async () => {
    const payload = await fetchApiWithDiagnostics<{ documents: CentreDocument[] }>(
      "/api/centre-ressources/list",
      { method: "GET" },
      { label: "BoDocumentDrawer" },
    );
    setDocument(payload.documents.find((item) => item.id === documentId) ?? null);
  }, [documentId]);

  const loadCompetences = useCallback(async () => {
    const { supabase } = await import("@/lib/supabase");
    const { data } = await supabase
      .from("referentiels")
      .select("id, discipline, domaine, competence, section, source_excerpt")
      .eq("document_source_id", documentId)
      .order("sort_order", { ascending: true })
      .limit(80);
    setCompetences((data ?? []) as CompetencePreview[]);
  }, [documentId]);

  useEffect(() => {
    void loadDocument();
    void loadCompetences();
  }, [loadDocument, loadCompetences]);

  async function runAction(
    action: string,
    route: string,
    body: Record<string, string>,
    successMessage: string,
  ) {
    setBusyAction(action);
    setError(null);
    setMessage(null);
    try {
      await fetchApiWithDiagnostics(route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }, { label: "BoDocumentDrawer" });
      setMessage(successMessage);
      await loadDocument();
      await loadCompetences();
      onUpdated();
    } catch (actionError) {
      setError(
        actionError instanceof ApiFetchDiagnosticError
          ? actionError.message
          : actionError instanceof Error
            ? actionError.message
            : "Action impossible.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  if (!document) {
    return (
      <FloraCard padding="lg" accent="lavender">
        <p className="text-sm font-light text-flora-text-subtle">Chargement du référentiel…</p>
      </FloraCard>
    );
  }

  const normalized = normalizeBoDocumentStatus(document.status);

  return (
    <FloraCard padding="lg" accent="lavender" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <FloraBadge accent="sage">Référentiel BO</FloraBadge>
            <FloraBadge accent="lavender">{BO_STATUS_LABELS[normalized] ?? document.status}</FloraBadge>
            {document.active_for_programmation ? (
              <FloraBadge accent="sage">Actif pour programmation</FloraBadge>
            ) : null}
          </div>
          <h3 className="font-serif text-2xl font-medium">{document.original_filename}</h3>
          <p className="mt-2 text-sm font-light text-flora-text-subtle">
            {document.matiere || "Matière"} · {document.cycle || "Cycle"} · {document.niveau || "Niveau"} ·{" "}
            {document.competence_count} compétence(s)
          </p>
        </div>
        <FloraButton variant="ghost" onClick={onClose}>
          Fermer
        </FloraButton>
      </div>

      {message ? <p className="rounded-2xl bg-sauge-light/25 px-4 py-3 text-sm text-sauge">{message}</p> : null}
      {error ? <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm text-[#b88989]">{error}</p> : null}
      {document.error_message ? (
        <p className="text-sm font-light text-[#b88989]">{document.error_message}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canAnalyzeBo(document.status) ? (
          <FloraButton
            accent="lavender"
            size="sm"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void runAction(
                "analyze",
                "/api/centre-ressources/analyze",
                { documentId },
                "Analyse Théa terminée.",
              )
            }
          >
            🧠 Réanalyser
          </FloraButton>
        ) : null}
        {canValidateBo(document.status) ? (
          <FloraButton
            accent="sage"
            size="sm"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void runAction(
                "validate",
                "/api/centre-ressources/validate",
                { documentId },
                "Référentiel validé.",
              )
            }
          >
            Valider
          </FloraButton>
        ) : null}
        {normalized === "READY" && !document.active_for_programmation ? (
          <FloraButton
            accent="sage"
            size="sm"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void runAction(
                "activate",
                "/api/centre-ressources/activate",
                { documentId },
                "Référentiel activé pour les programmations.",
              )
            }
          >
            Activer
          </FloraButton>
        ) : null}
        <FloraButton
          accent="rose"
          size="sm"
          variant="secondary"
          disabled={Boolean(busyAction)}
          onClick={() => {
            if (!window.confirm("Supprimer ce référentiel et ses compétences ?")) return;
            void runAction(
              "delete",
              "/api/centre-ressources/delete",
              { documentId },
              "Document supprimé.",
            ).then(onClose);
          }}
        >
          🗑 Supprimer
        </FloraButton>
      </div>

      {competences.length > 0 ? (
        <div className="max-h-80 overflow-y-auto rounded-2xl bg-white/45 p-3">
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
                  <td className="py-2 align-top font-light text-flora-text-subtle">{row.source_excerpt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm font-light text-flora-text-subtle">
          Aucune compétence enregistrée. Lancez l&apos;analyse Théa pour extraire le référentiel officiel.
        </p>
      )}
    </FloraCard>
  );
}
