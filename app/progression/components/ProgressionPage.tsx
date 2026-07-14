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
import { colors } from "@/lib/theme";
import { ProgressionForm } from "./ProgressionForm";
import { ProgressionImportWizard } from "./ProgressionImportWizard";
import { ProgressionTableView } from "./ProgressionTableView";
import {
  initialProgressionFormValues,
  type ProgressionFormValues,
  type ValidatedProgrammationOption,
} from "../types";

export function ProgressionPage() {
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
        subtitle="Transformez automatiquement votre programmation validée en progression détaillée, sans ressaisie."
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

      <ProgressionForm
        values={formValues}
        programmations={programmations}
        isLoadingProgrammations={isLoadingProgrammations}
        onChange={(key, value) => setFormValues((current) => ({ ...current, [key]: value }))}
        onGenerate={() => void handleGenerate()}
        onImport={() => setShowImportWizard(true)}
        isGenerating={isGenerating}
      />

      {showImportWizard ? (
        <ProgressionImportWizard
          programmations={programmations}
          defaultProgrammationId={formValues.programmationId}
          defaultMethode={formValues.methode}
          onComplete={(imported) => {
            setPayload(imported);
            setActiveTabKey(imported.tabs[0]?.subjectKey ?? "");
            setShowImportWizard(false);
            setError(null);
          }}
          onClose={() => setShowImportWizard(false)}
        />
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

      {!payload && !isGenerating && (
        <FloraCard padding="lg">
          <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Sélectionnez une programmation validée puis cliquez sur « Générer ma progression ».
          </p>
        </FloraCard>
      )}
    </div>
  );
}
