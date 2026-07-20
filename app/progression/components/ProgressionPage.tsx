"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { TrashConfirmDialog } from "@/components/pedagogical/TrashConfirmDialog";
import { PedagogicalSubjectBrowser } from "@/components/pedagogical/PedagogicalSubjectBrowser";
import type { PedagogicalDocumentListItem } from "@/components/pedagogical/PedagogicalDocumentCard";
import { PedagogicalModuleToolbar } from "@/components/pedagogical/PedagogicalModuleToolbar";
import {
  DocumentViewModeToggle,
  FaithfulSourceTableView,
  resolveDefaultDocumentViewMode,
  type DocumentViewMode,
} from "@/components/pedagogical/FaithfulSourceTableView";
import { isSourceDocumentEmpty } from "@/lib/import/source-document";
import { downloadSourceDocumentExcel, printFaithfulTable } from "@/lib/import/source-document-export";
import {
  initialProgressionFormValues,
  type ProgressionFormValues,
  type ValidatedProgrammationOption,
} from "../types";

const LAST_PROGRESSION_KEY = "flora:last-progression-id";

type SavedProgressionListItem = {
  id: string;
  title: string;
  status: string;
  matiere?: string;
  sous_matiere?: string;
  niveau?: string;
  periode?: string;
  created_at?: string;
  metadata?: unknown;
};

type ProgressionPageMode = null | "menu" | "generate" | "import" | "manual";

export function ProgressionPage() {
  return (
    <Suspense fallback={<p className="text-sm font-light text-flora-text-subtle">Chargement…</p>}>
      <ProgressionPageContent />
    </Suspense>
  );
}

function ProgressionPageContent() {
  const searchParams = useSearchParams();
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
  const [savedProgressions, setSavedProgressions] = useState<SavedProgressionListItem[]>([]);
  const [importPrefill, setImportPrefill] = useState({ matiere: "", sousMatiere: "" });
  const [deleteTarget, setDeleteTarget] = useState<SavedProgressionListItem | null>(null);
  const [isDeletingProgression, setIsDeletingProgression] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DocumentViewMode>("structured");

  const loadSavedProgression = useCallback(async (progressionId: string) => {
    const response = await fetch(`/api/progression/details?id=${encodeURIComponent(progressionId)}`);
    if (!response.ok) return;
    const data = (await response.json()) as ProgressionPayload;
    setPayload(data);
    setActiveTabKey(data.tabs[0]?.subjectKey ?? "");
    setMode(null);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(LAST_PROGRESSION_KEY, progressionId);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProgrammations() {
      setIsLoadingProgrammations(true);

      try {
        const [progResponse, listResponse] = await Promise.all([
          fetch("/api/progression/programmations"),
          fetch("/api/progression/list"),
        ]);
        const data = (await progResponse.json()) as {
          programmations?: ValidatedProgrammationOption[];
          error?: string;
        };

        if (!progResponse.ok) {
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

        if (listResponse.ok && !cancelled) {
          const listData = (await listResponse.json()) as {
            progressions?: SavedProgressionListItem[];
          };
          const progressions = listData.progressions ?? [];
          setSavedProgressions(progressions);
          const urlId = searchParams.get("id");
          const lastId =
            typeof window !== "undefined" ? sessionStorage.getItem(LAST_PROGRESSION_KEY) : null;
          const targetId =
            progressions.find((p) => p.id === urlId)?.id ??
            progressions.find((p) => p.id === lastId)?.id ??
            progressions[0]?.id;
          if (targetId) {
            await loadSavedProgression(targetId);
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
  }, [loadSavedProgression, searchParams]);

  useEffect(() => {
    if (!payload) return;
    setViewMode(
      resolveDefaultDocumentViewMode({
        sourceDocument: payload.sourceDocument,
        sourceType: payload.sourceType,
      }),
    );
  }, [payload?.progression.id, payload?.sourceDocument, payload?.sourceType]);

  const hasFaithfulSource = Boolean(
    payload?.sourceDocument && !isSourceDocumentEmpty(payload.sourceDocument),
  );

  const refreshSavedProgressions = useCallback(async () => {
    const response = await fetch("/api/progression/list");
    if (!response.ok) return [];

    const listData = (await response.json()) as {
      progressions?: SavedProgressionListItem[];
    };
    const progressions = listData.progressions ?? [];
    setSavedProgressions(progressions);
    return progressions;
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (isDeletingProgression) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }, [isDeletingProgression]);

  const handleConfirmTrash = useCallback(async () => {
    if (!deleteTarget) return;

    setIsDeletingProgression(true);
    setDeleteError(null);

    try {
      const response = await fetch("/api/progression/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Impossible de placer dans la Corbeille.");
      }

      const remaining = (await refreshSavedProgressions()).filter(
        (item) => item.id !== deleteTarget.id,
      );

      if (payload?.progression.id === deleteTarget.id) {
        setPayload(null);
        setActiveTabKey("");
        setMode("menu");
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(LAST_PROGRESSION_KEY);
        }

        const nextId = remaining[0]?.id;
        if (nextId) {
          await loadSavedProgression(nextId);
        }
      }

      closeDeleteDialog();
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof Error
          ? deleteFailure.message
          : "Impossible de placer dans la Corbeille.",
      );
    } finally {
      setIsDeletingProgression(false);
    }
  }, [closeDeleteDialog, deleteTarget, loadSavedProgression, payload?.progression.id, refreshSavedProgressions]);

  const progressionListItems = useMemo<PedagogicalDocumentListItem[]>(
    () =>
      savedProgressions.map((item) => ({
        id: item.id,
        title: item.title,
        matiere: item.matiere,
        sous_matiere: item.sous_matiere,
        niveau: item.niveau,
        periode: item.periode,
        status: item.status,
        created_at: item.created_at,
        metadata: item.metadata,
        documentType: "Progression",
      })),
    [savedProgressions],
  );

  const handleMoveProgressionSubject = useCallback(
    async (id: string, matiere: string, sousMatiere: string) => {
      const response = await fetch("/api/pedagogical/subject", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "progression",
          entityId: id,
          matiere,
          sousMatiere,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Impossible de déplacer la progression.");
        return;
      }
      await refreshSavedProgressions();
    },
    [refreshSavedProgressions],
  );

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
      if (data.progression?.id && typeof window !== "undefined") {
        sessionStorage.setItem(LAST_PROGRESSION_KEY, data.progression.id);
      }
      void refreshSavedProgressions();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Impossible de générer la progression.",
      );
    } finally {
      setIsGenerating(false);
    }
  }, [formValues, refreshSavedProgressions]);

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

      <PedagogicalModuleToolbar
        importLabel="Importer une progression"
        onImport={() => {
          setImportPrefill({ matiere: "", sousMatiere: "" });
          setShowImportWizard(true);
          setError(null);
        }}
        onCreateManual={() => setMode("manual")}
        onDuplicate={() => setMode("generate")}
      />

      {savedProgressions.length > 0 ? (
        <PedagogicalSubjectBrowser
          module="progression"
          moduleLabel="Progressions"
          documentTypeLabel="Progressions"
          items={progressionListItems}
          selectedId={payload?.progression.id}
          onSelect={(id) => void loadSavedProgression(id)}
          onImport={(prefill) => {
            setImportPrefill(prefill);
            setShowImportWizard(true);
          }}
          onCreateManual={() => setMode("manual")}
          onMoveSubject={(id, matiere, sousMatiere) =>
            void handleMoveProgressionSubject(id, matiere, sousMatiere)
          }
          onTrash={(item) => setDeleteTarget(item as SavedProgressionListItem)}
        />
      ) : null}

      {deleteTarget ? (
        <TrashConfirmDialog
          title="Placer dans la Corbeille ?"
          description={`Voulez-vous placer « ${deleteTarget.title} » dans la Corbeille ? Vous pourrez le restaurer pendant 30 jours.`}
          isSubmitting={isDeletingProgression}
          error={deleteError}
          onCancel={closeDeleteDialog}
          onConfirm={() => void handleConfirmTrash()}
        />
      ) : null}

      {showImportWizard ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-0 sm:items-center sm:p-4">
          <div className="h-[100dvh] w-full max-w-3xl overflow-y-auto overflow-x-hidden sm:h-auto sm:max-h-[90vh]">
            <ProgressionImportWizard
              programmations={programmations}
              defaultProgrammationId={formValues.programmationId}
              defaultMethode={formValues.methode}
              defaultMatiere={importPrefill.matiere}
              defaultSousMatiere={importPrefill.sousMatiere}
              onComplete={(imported) => {
                setPayload(imported);
                setActiveTabKey(imported.tabs[0]?.subjectKey ?? "");
                setShowImportWizard(false);
                setMode(null);
                setError(null);
                if (imported.progression?.id) {
                  sessionStorage.setItem(LAST_PROGRESSION_KEY, imported.progression.id);
                  void loadSavedProgression(imported.progression.id);
                  void refreshSavedProgressions();
                }
              }}
              onClose={() => setShowImportWizard(false)}
            />
          </div>
        </div>
      ) : null}

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
              onSelect: () => setShowImportWizard(true),
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
          onImport={() => setShowImportWizard(true)}
          isGenerating={isGenerating}
        />
      ) : null}

      {mode === "manual" ? (
        <FloraCard padding="lg" accent="rose">
          <p className="text-sm font-light text-flora-text-muted">
            Création manuelle : importez un fichier Excel/PDF/JPG ou utilisez l&apos;import sans
            programmation pour démarrer rapidement.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <FloraButton onClick={() => setShowImportWizard(true)}>Importer une progression</FloraButton>
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
              {viewMode === "faithful" && payload.sourceDocument ? (
                <>
                  <FloraButton
                    onClick={() =>
                      downloadSourceDocumentExcel(
                        payload.sourceDocument!,
                        payload.progression.title || "progression",
                      )
                    }
                  >
                    Exporter Excel (fidèle)
                  </FloraButton>
                  <FloraButton variant="secondary" onClick={() => printFaithfulTable("faithful-source-table")}>
                    Imprimer
                  </FloraButton>
                </>
              ) : (
                <>
                  <FloraButton onClick={() => progressionExporter.exportPayload(payload, "word")}>
                    Exporter Word
                  </FloraButton>
                  <FloraButton variant="secondary" onClick={() => progressionExporter.exportPayload(payload, "excel")}>
                    Exporter Excel
                  </FloraButton>
                  <FloraButton variant="secondary" onClick={() => progressionExporter.exportPayload(payload, "pdf")}>
                    Exporter PDF
                  </FloraButton>
                </>
              )}
            </div>
          </FloraCard>

          <FloraCard padding="md" accent="cream">
            <DocumentViewModeToggle
              mode={viewMode}
              hasFaithfulSource={hasFaithfulSource}
              onChange={setViewMode}
            />
          </FloraCard>

          {viewMode === "faithful" && payload.sourceDocument && payload.progression.id ? (
            <FloraCard padding="lg" accent="sage">
              <FaithfulSourceTableView
                sourceDocument={payload.sourceDocument}
                entityType="progression"
                entityId={payload.progression.id}
                onDocumentChange={(sourceDocument) =>
                  setPayload((current) => (current ? { ...current, sourceDocument } : current))
                }
              />
            </FloraCard>
          ) : (
          <>
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
