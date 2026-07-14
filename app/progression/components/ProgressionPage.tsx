"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import {
  buildProgressionValidationReport,
} from "@/lib/progression/ProgressionValidator";
import { progressionExporter } from "@/lib/progression/ProgressionExporter";
import type { ProgressionPayload, ProgressionRow, ProgressionTab } from "@/lib/progression/types";
import {
  PedagogicalLinkBadge,
  PedagogicalStartMenu,
} from "@/components/pedagogical/PedagogicalStartMenu";
import { ProgressionForm } from "./ProgressionForm";
import { ProgressionImportWizard } from "./ProgressionImportWizard";
import { ProgressionTableView } from "./ProgressionTableView";
import {
  initialProgressionFormValues,
  type ProgressionFormValues,
  type ValidatedProgrammationOption,
} from "../types";

type ProgressionPageMode = null | "menu" | "generate" | "import" | "manual";

export function ProgressionPage() {
  const [mode, setMode] = useState<ProgressionPageMode>("menu");
  const [formValues, setFormValues] = useState<ProgressionFormValues>(
    initialProgressionFormValues,
  );
  const [programmations, setProgrammations] = useState<ValidatedProgrammationOption[]>([]);
  const [isLoadingProgrammations, setIsLoadingProgrammations] = useState(true);
  const [payload, setPayload] = useState<ProgressionPayload | null>(null);
  const [activeTabKey, setActiveTabKey] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProgrammations() {
      setIsLoadingProgrammations(true);

      try {
        const response = await fetch("/api/progression/programmations");
        const data = (await response.json()) as {
          programmations?: ValidatedProgrammationOption[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Impossible de charger les programmations.");
        }

        if (!cancelled) {
          const items = data.programmations ?? [];
          setProgrammations(items);
          if (items[0]) {
            setFormValues((current) => ({
              ...current,
              programmationId: items[0].id,
              methode: items[0].methode ?? current.methode,
            }));
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les programmations.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProgrammations(false);
        }
      }
    }

    void loadProgrammations();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/progression/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formValues),
      });

      const data = (await response.json()) as ProgressionPayload & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Impossible de générer la progression.");
      }

      setPayload(data);
      setActiveTabKey(data.tabs[0]?.subjectKey ?? "");
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Impossible de générer la progression.",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [formValues]);

  const updateTab = useCallback((tabKey: string, updater: (tab: ProgressionTab) => ProgressionTab) => {
    setPayload((current) => {
      if (!current) return current;

      return {
        ...current,
        tabs: current.tabs.map((tab) =>
          tab.subjectKey === tabKey ? updater(tab) : tab,
        ),
      };
    });
  }, []);

  const handleRowChange = useCallback(
    async (tabKey: string, rowId: string, row: ProgressionRow) => {
      updateTab(tabKey, (tab) => ({
        ...tab,
        rows: tab.rows.map((item) => (item.id === rowId ? row : item)),
      }));

      if (!rowId.startsWith("draft-")) {
        await fetch("/api/progression/row", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowId, row }),
        });
      }
    },
    [updateTab],
  );

  const activeTab = payload?.tabs.find((tab) => tab.subjectKey === activeTabKey);

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="Progression annuelle"
        subtitle="Créez, importez ou générez votre progression — avec ou sans programmation associée."
        meta={payload ? payload.progression.title : undefined}
        action={
          <Link
            href="/programmation"
            className="rounded-2xl border border-white/70 bg-white/50 px-4 py-2 text-sm font-light text-flora-text-muted transition hover:bg-white/80"
          >
            Voir la programmation
          </Link>
        }
      />

      {mode === "menu" && !payload ? (
        <PedagogicalStartMenu
          moduleTitle="Que souhaitez-vous faire ?"
          moduleSubtitle="Une progression peut exister seule ou être liée à une programmation existante."
          options={[
            {
              id: "manual",
              title: "Créer une progression manuellement",
              description: "Définir titre, matière et semaines sans document source.",
              badge: "Indépendante",
              onSelect: () => setMode("manual"),
            },
            {
              id: "import",
              title: "Importer une progression existante",
              description: "Excel, PDF ou JPG — programmation associée facultative.",
              onSelect: () => setMode("import"),
            },
            {
              id: "generate",
              title: "Générer depuis une programmation",
              description: "À partir d'une programmation validée, avec enrichissement Flora.",
              badge: "Liée",
              onSelect: () => setMode("generate"),
              disabled: programmations.length === 0 && !isLoadingProgrammations,
            },
            {
              id: "link",
              title: "Associer à une programmation",
              description: "Créer ou importer d'abord, puis lier depuis la progression ouverte.",
              onSelect: () => setMode("generate"),
              disabled: programmations.length === 0,
            },
          ]}
        />
      ) : null}

      {mode === "generate" ? (
        <ProgressionForm
          values={formValues}
          programmations={programmations}
          isLoadingProgrammations={isLoadingProgrammations}
          onChange={(key, value) => setFormValues((current) => ({ ...current, [key]: value }))}
          onGenerate={() => void handleGenerate()}
          onImport={() => setMode("import")}
          isGenerating={isGenerating}
        />
      ) : null}

      {mode === "import" ? (
        <ProgressionImportWizard
          programmations={programmations}
          defaultProgrammationId={formValues.programmationId}
          defaultMethode={formValues.methode}
          onComplete={(imported) => {
            setPayload(imported);
            setActiveTabKey(imported.tabs[0]?.subjectKey ?? "");
            setShowImportWizard(false);
            setMode(null);
            setError(null);
          }}
          onClose={() => {
            setShowImportWizard(false);
            setMode("menu");
          }}
        />
      ) : null}

      {mode === "manual" ? (
        <FloraCard padding="lg" accent="rose">
          <p className="text-sm font-light text-flora-text-muted">
            Création manuelle : importez un fichier Excel/PDF/JPG ou utilisez l&apos;import sans
            programmation pour démarrer rapidement.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <FloraButton onClick={() => setMode("import")}>Importer une progression</FloraButton>
            <FloraButton variant="secondary" onClick={() => setMode("menu")}>
              Retour
            </FloraButton>
          </div>
        </FloraCard>
      ) : null}

      {mode !== "menu" && mode !== null && !payload ? (
        <FloraButton variant="ghost" onClick={() => setMode("menu")}>
          ← Retour au menu
        </FloraButton>
      ) : null}

      {error && (
        <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm font-light text-[#b88989]">
          {error}
        </p>
      )}

      {payload && (
        <>
          <FloraCard padding="lg" accent="lavender">
            <div className="flex flex-wrap items-center gap-3">
              <FloraBadge accent={payload.validation.valid ? "sage" : "peach"}>
                {payload.validation.valid ? "Validée" : "À corriger"}
              </FloraBadge>
              <PedagogicalLinkBadge
                mode={payload.programmation ? "linked" : "independent"}
                label={
                  payload.programmation
                    ? "Liée à une programmation"
                    : "Indépendante"
                }
              />
              <FloraBadge accent="cream">
                {Math.round(payload.validation.summary.completionRate * 100)} % complété
              </FloraBadge>
              <p className="text-sm font-light text-flora-text-muted">
                {buildProgressionValidationReport(payload.validation)}
              </p>
            </div>

            {payload.validation.issues.length > 0 && (
              <ul className="mt-4 space-y-2">
                {payload.validation.issues.map((issue) => (
                  <li key={`${issue.code}-${issue.message}`} className="text-sm font-light text-flora-text-muted">
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <FloraButton onClick={() => progressionExporter.exportPayload(payload, "word")}>
                Exporter Word
              </FloraButton>
              <FloraButton variant="secondary" onClick={() => progressionExporter.exportPayload(payload, "excel")}>
                Exporter Excel
              </FloraButton>
              <FloraButton variant="secondary" onClick={() => progressionExporter.exportPayload(payload, "pdf")}>
                Exporter PDF
              </FloraButton>
            </div>
          </FloraCard>

          <FloraCard padding="md" accent="lavender">
            <div className="flex flex-wrap gap-2">
              {payload.tabs.map((tab) => (
                <button
                  key={tab.subjectKey}
                  type="button"
                  onClick={() => setActiveTabKey(tab.subjectKey)}
                  className={`rounded-2xl px-4 py-2 text-sm font-light transition ${
                    activeTabKey === tab.subjectKey
                      ? "bg-lavender-light/50 text-flora-text"
                      : "bg-white/40 text-flora-text-muted hover:bg-white/70"
                  }`}
                >
                  {tab.subSubjectLabel || tab.subjectLabel}
                </button>
              ))}
            </div>
          </FloraCard>

          {activeTab && (
            <ProgressionTableView
              tab={activeTab}
              onRowChange={(rowId, row) => void handleRowChange(activeTab.subjectKey, rowId, row)}
              onRowsReorder={(rows) =>
                updateTab(activeTab.subjectKey, (tab) => ({ ...tab, rows }))
              }
            />
          )}
        </>
      )}

      {!payload && !isGenerating && mode === "menu" ? null : !payload && !isGenerating && mode !== "import" && mode !== "manual" ? (
        <FloraCard padding="lg">
          <p className="text-sm font-light text-flora-text-muted">
            {mode === "generate"
              ? "Sélectionnez une programmation validée puis cliquez sur « Générer ma progression »."
              : "Choisissez une action ci-dessus pour commencer."}
          </p>
        </FloraCard>
      ) : null}
    </div>
  );
}
