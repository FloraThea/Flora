"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { fetchApiWithDiagnostics } from "@/lib/api/client-fetch";
import { colors } from "@/lib/theme";

type BoLibraryDocument = {
  id: string;
  original_filename: string;
  matiere: string;
  cycle: string;
  niveau: string;
  status: string;
  active_for_programmation: boolean;
  competence_count: number;
  sections: string[];
};

const LIST_ROUTE = "/api/referentiel-bo/list";
const ACTIVATE_ROUTE = "/api/referentiel-bo/activate";

function statusAccent(status: string): "sage" | "lavender" | "peach" | "cream" {
  if (status === "ready") return "sage";
  if (status === "analyzed") return "lavender";
  if (status === "error") return "peach";
  return "cream";
}

export function BoDocumentsPanel() {
  const [documents, setDocuments] = useState<BoLibraryDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const payload = await fetchApiWithDiagnostics<{ documents: BoLibraryDocument[] }>(
        LIST_ROUTE,
        { method: "GET" },
        { label: "BoDocumentsPanel" },
      );
      setDocuments(payload.documents ?? []);
    } catch {
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const handleActivate = useCallback(
    async (documentId: string) => {
      setActivatingId(documentId);
      setMessage(null);
      try {
        await fetchApiWithDiagnostics(
          ACTIVATE_ROUTE,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId }),
          },
          { label: "BoDocumentsPanel" },
        );
        setMessage("Référentiel activé pour les programmations.");
        await loadDocuments();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Activation impossible.");
      } finally {
        setActivatingId(null);
      }
    },
    [loadDocuments],
  );

  return (
    <FloraCard padding="lg" accent="sage">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2
            className="font-serif text-2xl font-medium"
            style={{ color: colors.charcoal.DEFAULT }}
          >
            Documents BO importés
          </h2>
          <p className="mt-2 text-sm font-light" style={{ color: colors.charcoal.subtle }}>
            Référentiels officiels enregistrés et réutilisables par Programmation, Progression,
            Séquences et Séances.
          </p>
        </div>
        <Link href="/referentiel-bo">
          <FloraButton accent="sage" variant="secondary">
            Importer un BO
          </FloraButton>
        </Link>
      </div>

      {message ? (
        <p className="mt-4 rounded-2xl bg-sauge-light/25 px-4 py-3 text-sm font-light text-sauge">
          {message}
        </p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-sm font-light" style={{ color: colors.charcoal.faint }}>
          Chargement des référentiels BO…
        </p>
      ) : documents.length === 0 ? (
        <p className="mt-6 text-sm font-light" style={{ color: colors.charcoal.faint }}>
          Aucun référentiel BO enregistré. Importez un programme officiel depuis le module
          Référentiel BO.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {documents.map((document) => (
            <div
              key={document.id}
              className="rounded-2xl border border-white/70 bg-white/45 px-4 py-4"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium" style={{ color: colors.charcoal.DEFAULT }}>
                    {document.original_filename}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <FloraBadge accent="lavender" size="sm">
                      {document.matiere || "Matière non précisée"}
                    </FloraBadge>
                    <FloraBadge accent="cream" size="sm">
                      {document.cycle || "Cycle non précisé"}
                    </FloraBadge>
                    <FloraBadge accent={statusAccent(document.status)} size="sm">
                      {document.status}
                    </FloraBadge>
                    {document.active_for_programmation ? (
                      <FloraBadge accent="sage" size="sm">
                        Actif
                      </FloraBadge>
                    ) : null}
                  </div>
                  <p
                    className="mt-2 text-sm font-light"
                    style={{ color: colors.charcoal.subtle }}
                  >
                    {document.competence_count} compétence(s)
                    {document.niveau ? ` · ${document.niveau}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/referentiel-bo?documentId=${document.id}`}>
                    <FloraButton accent="lavender" variant="secondary">
                      Ouvrir
                    </FloraButton>
                  </Link>
                  {document.status === "ready" && !document.active_for_programmation ? (
                    <FloraButton
                      accent="sage"
                      onClick={() => void handleActivate(document.id)}
                      disabled={activatingId === document.id}
                    >
                      Utiliser
                    </FloraButton>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </FloraCard>
  );
}
