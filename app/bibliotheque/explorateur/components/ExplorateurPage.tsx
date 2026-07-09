"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import type { ExplorerPayload } from "@/lib/knowledge/types";
import type { FloraDocument } from "@/lib/documents/types";
import { colors } from "@/lib/theme";
import { RelationGraph } from "./RelationGraph";

type ExplorerTab =
  | "sections"
  | "competences"
  | "notions"
  | "tags"
  | "relations";

export function ExplorateurPage() {
  const [documents, setDocuments] = useState<FloraDocument[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [payload, setPayload] = useState<ExplorerPayload | null>(null);
  const [activeTab, setActiveTab] = useState<ExplorerTab>("sections");
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isLoadingExplorer, setIsLoadingExplorer] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadExplorer = useCallback(async (documentId: string) => {
    if (!documentId) return;

    setIsLoadingExplorer(true);
    setError(null);

    try {
      const response = await fetch(`/api/knowledge/explorer?id=${documentId}`);
      const data = (await response.json()) as ExplorerPayload & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Impossible de charger l'explorateur.");
      }

      setPayload(data);
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger l'explorateur.",
      );
    } finally {
      setIsLoadingExplorer(false);
    }
  }, []);

  useEffect(() => {
    async function loadDocuments() {
      setIsLoadingDocs(true);

      try {
        const response = await fetch("/api/documents/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = (await response.json()) as {
          documents?: FloraDocument[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Impossible de charger les documents.");
        }

        const docs = data.documents ?? [];
        setDocuments(docs);
        if (docs[0]) {
          setSelectedDocumentId(docs[0].id);
          void loadExplorer(docs[0].id);
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger les documents.",
        );
      } finally {
        setIsLoadingDocs(false);
      }
    }

    void loadDocuments();
  }, [loadExplorer]);

  const handleDocumentChange = useCallback(
    (documentId: string) => {
      setSelectedDocumentId(documentId);
      void loadExplorer(documentId);
    },
    [loadExplorer],
  );

  const competences = useMemo(
    () => payload?.entities.filter((entity) => entity.entity_type === "competence") ?? [],
    [payload],
  );

  const notions = useMemo(
    () =>
      payload?.entities.filter((entity) =>
        ["notion", "objectif", "lexique", "oeuvre", "album", "personnage"].includes(
          entity.entity_type,
        ),
      ) ?? [],
    [payload],
  );

  const tabs: Array<{ id: ExplorerTab; label: string; count: number }> = [
    { id: "sections", label: "Sections", count: payload?.sections.length ?? 0 },
    { id: "competences", label: "Compétences", count: competences.length },
    { id: "notions", label: "Notions", count: notions.length },
    { id: "tags", label: "Tags", count: payload?.tags.length ?? 0 },
    { id: "relations", label: "Relations", count: payload?.relations.length ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="Explorateur de connaissances"
        subtitle="Naviguez dans la structure pédagogique extraite de chaque document : sections, entités, tags et relations."
        meta={
          payload
            ? `${payload.entities.length} entité${payload.entities.length > 1 ? "s" : ""}`
            : undefined
        }
        action={
          <Link
            href="/bibliotheque"
            className="rounded-2xl border border-white/70 bg-white/50 px-4 py-2 text-sm font-light text-flora-text-muted transition hover:bg-white/80"
          >
            Retour à la bibliothèque
          </Link>
        }
      />

      <FloraCard padding="lg" accent="rose">
        <label className="block">
          <span
            className="mb-2 block text-[11px] font-medium tracking-[0.12em] uppercase"
            style={{ color: colors.charcoal.label }}
          >
            Document
          </span>
          <select
            value={selectedDocumentId}
            onChange={(event) => handleDocumentChange(event.target.value)}
            disabled={isLoadingDocs || documents.length === 0}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          >
            {documents.map((document) => (
              <option key={document.id} value={document.id}>
                {document.title || document.original_filename}
              </option>
            ))}
          </select>
        </label>
      </FloraCard>

      {error && (
        <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm font-light text-[#b88989]">
          {error}
        </p>
      )}

      {isLoadingExplorer ? (
        <FloraCard padding="lg">
          <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Chargement de la structure pédagogique…
          </p>
        </FloraCard>
      ) : payload ? (
        <>
          <FloraCard padding="lg" accent="lavender">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-2xl px-4 py-2 text-sm font-light transition ${
                    activeTab === tab.id
                      ? "bg-lavender-light/50 text-flora-text"
                      : "bg-white/40 text-flora-text-muted hover:bg-white/70"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </FloraCard>

          {activeTab === "sections" && (
            <section className="grid gap-4">
              {payload.sections.map((section) => (
                <FloraCard key={String(section.id)} padding="md">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-serif text-lg text-flora-text">
                      {String(section.title || "Section")}
                    </h3>
                    <FloraBadge accent="lavender">{String(section.section_type || "section")}</FloraBadge>
                  </div>
                  <p className="text-sm font-light whitespace-pre-wrap text-flora-text-muted">
                    {String(section.content || "")}
                  </p>
                </FloraCard>
              ))}
            </section>
          )}

          {activeTab === "competences" && (
            <section className="grid gap-4 lg:grid-cols-2">
              {competences.map((entity) => {
                const boLink = payload.boLinks.find((link) => link.entity_id === entity.id);

                return (
                  <FloraCard key={entity.id} padding="md" accent="peach">
                    <h3 className="font-serif text-lg text-flora-text">{entity.label}</h3>
                    <p className="mt-2 text-sm font-light text-flora-text-muted">{entity.source_text}</p>
                    {boLink && (
                      <p className="mt-3 text-xs font-light text-sauge">
                        Lien BO : {boLink.matched_label} ({Math.round(boLink.confidence * 100)} %)
                      </p>
                    )}
                  </FloraCard>
                );
              })}
            </section>
          )}

          {activeTab === "notions" && (
            <section className="grid gap-4 lg:grid-cols-2">
              {notions.map((entity) => (
                <FloraCard key={entity.id} padding="md">
                  <div className="mb-2 flex items-center gap-2">
                    <FloraBadge accent="sage">{entity.entity_type}</FloraBadge>
                    <h3 className="font-serif text-lg text-flora-text">{entity.label}</h3>
                  </div>
                  <p className="text-sm font-light text-flora-text-muted">{entity.content || entity.source_text}</p>
                </FloraCard>
              ))}
            </section>
          )}

          {activeTab === "tags" && (
            <FloraCard padding="lg">
              <div className="flex flex-wrap gap-2">
                {payload.tags.map((tag) => (
                  <FloraBadge key={String(tag.id)} accent="rose">
                    {String(tag.tag)}
                  </FloraBadge>
                ))}
              </div>
            </FloraCard>
          )}

          {activeTab === "relations" && (
            <section className="flex flex-col gap-6">
              <RelationGraph nodes={payload.graph.nodes} edges={payload.graph.edges} />
              <div className="grid gap-3 lg:grid-cols-2">
                {payload.relations.map((relation) => {
                  const source = payload.entities.find((entity) => entity.id === relation.source_entity_id);
                  const target = payload.entities.find((entity) => entity.id === relation.target_entity_id);

                  return (
                    <FloraCard key={relation.id} padding="sm">
                      <p className="text-sm font-light text-flora-text-muted">
                        <span className="text-flora-text">{source?.label ?? "Entité"}</span>
                        {" → "}
                        <span className="text-sauge">{relation.relation_type}</span>
                        {" → "}
                        <span className="text-flora-text">{target?.label ?? "Entité"}</span>
                      </p>
                    </FloraCard>
                  );
                })}
              </div>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
