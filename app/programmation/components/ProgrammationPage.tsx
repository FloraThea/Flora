"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import { buildValidationReport, programmingExporter } from "@/lib/programming/ProgrammingExporter";
import type { ProgrammationPayload, ProgrammingCellContent } from "@/lib/programming/types";
import type { ProfilFormValues } from "@/lib/profile/types";
import { colors } from "@/lib/theme";
import { CalendarPreview } from "./CalendarPreview";
import { PedagogicalModuleToolbar } from "@/components/pedagogical/PedagogicalModuleToolbar";
import { PedagogicalSubjectBrowser } from "@/components/pedagogical/PedagogicalSubjectBrowser";
import type { PedagogicalDocumentListItem } from "@/components/pedagogical/PedagogicalDocumentCard";
import {
  DocumentViewModeToggle,
  FaithfulSourceTableView,
  resolveDefaultDocumentViewMode,
  type DocumentViewMode,
} from "@/components/pedagogical/FaithfulSourceTableView";
import { isSourceDocumentEmpty } from "@/lib/import/source-document";
import { downloadSourceDocumentExcel, printFaithfulTable } from "@/lib/import/source-document-export";
import { ProgrammationForm } from "./ProgrammationForm";
import { ProgrammingTableView } from "./ProgrammingTableView";
import { ProgrammationImportWizard } from "./ProgrammationImportWizard";
import { initialFormValues, EMPTY_TIMETABLE, type ProgrammationFormValues } from "../types";
import { payloadToTimetableInput } from "@/lib/timetable/timetable-input-utils";

const LAST_PROGRAMMATION_KEY = "flora:last-programmation-id";

type ProfilApiResponse = {
  values: ProfilFormValues;
  completion: { complete: boolean; missing: string[] };
  error?: string;
};

function applyProfileToFormValues(
  current: ProgrammationFormValues,
  profile: ProfilFormValues,
): ProgrammationFormValues {
  return {
    ...current,
    schoolYear: profile.schoolYear || current.schoolYear,
    academicZone: profile.zoneScolaire || current.academicZone,
    levels: profile.levels.length > 0 ? profile.levels : current.levels,
    methode: profile.primaryMethod || profile.methods[0] || current.methode,
    projetAnnuel:
      profile.projects.find((project) => project.projectType === "annuel")?.title ||
      profile.projects.find((project) => project.projectType === "theme")?.title ||
      current.projetAnnuel,
  };
}

export function ProgrammationPage() {
  return (
    <Suspense fallback={<p className="text-sm font-light text-flora-text-subtle">Chargement…</p>}>
      <ProgrammationPageContent />
    </Suspense>
  );
}

function ProgrammationPageContent() {
  const searchParams = useSearchParams();
  const [formValues, setFormValues] = useState<ProgrammationFormValues>(initialFormValues);
  const [payload, setPayload] = useState<ProgrammationPayload | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPhase, setGenerationPhase] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedStep, setFailedStep] = useState<string | null>(null);
  const [referentielWarning, setReferentielWarning] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(true);
  const [savedProgrammations, setSavedProgrammations] = useState<
    Array<{
      id: string;
      title: string;
      school_year: string;
      status: string;
      matiere?: string;
      sous_matiere?: string;
      source_file_name?: string;
      created_at?: string;
      metadata?: unknown;
    }>
  >([]);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [viewMode, setViewMode] = useState<DocumentViewMode>("structured");

  const loadSavedProgrammation = useCallback(async (programmationId: string) => {
    const response = await fetch(`/api/programmation/details?id=${encodeURIComponent(programmationId)}`);
    if (!response.ok) return;
    const data = (await response.json()) as ProgrammationPayload;
    setPayload(data);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(LAST_PROGRAMMATION_KEY, programmationId);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const [profileResponse, edtResponse, listResponse] = await Promise.all([
          fetch("/api/profil"),
          fetch("/api/emploi-du-temps"),
          fetch("/api/programmation/list"),
        ]);
        const data = (await profileResponse.json()) as ProfilApiResponse;

        if (profileResponse.ok) {
          setFormValues((current) => applyProfileToFormValues(current, data.values));
          setProfileComplete(data.completion.complete);
        }

        if (edtResponse.ok) {
          const edt = (await edtResponse.json()) as {
            slots?: Array<{ day: string; start: string; end: string; subject: string; hours?: number }>;
          };
          if (edt.slots?.length) {
            setFormValues((current) => ({
              ...current,
              timetable: payloadToTimetableInput(edt.slots ?? []),
            }));
          } else {
            setFormValues((current) => ({ ...current, timetable: EMPTY_TIMETABLE }));
          }
        }

        if (listResponse.ok) {
          const listData = (await listResponse.json()) as {
            programmations?: Array<{
              id: string;
              title: string;
              school_year: string;
              status: string;
              matiere?: string;
              sous_matiere?: string;
              source_file_name?: string;
              created_at?: string;
              metadata?: unknown;
            }>;
          };
          const items = listData.programmations ?? [];
          setSavedProgrammations(items);
          const urlId = searchParams.get("id");
          const lastId =
            typeof window !== "undefined"
              ? sessionStorage.getItem(LAST_PROGRAMMATION_KEY)
              : null;
          const targetId =
            items.find((item) => item.id === urlId)?.id ??
            items.find((item) => item.id === lastId)?.id ??
            items[0]?.id;
          if (targetId) {
            await loadSavedProgrammation(targetId);
          }
        }
      } catch {
        // Le profil sera exigé à la génération.
      } finally {
        setIsLoadingSaved(false);
      }
    })();
  }, [loadSavedProgrammation, searchParams]);

  useEffect(() => {
    if (!payload) return;
    setViewMode(
      resolveDefaultDocumentViewMode({
        sourceDocument: payload.sourceDocument,
        sourceType: payload.sourceType,
      }),
    );
  }, [payload?.programmation.id, payload?.sourceDocument, payload?.sourceType]);

  const hasFaithfulSource = Boolean(
    payload?.sourceDocument && !isSourceDocumentEmpty(payload.sourceDocument),
  );

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    setFailedStep(null);
    setReferentielWarning(null);
    setGenerationPhase("Préparation des données…");

    try {
      setGenerationPhase("Analyse du référentiel et génération par l'IA…");
      const response = await fetch("/api/programmation/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolYear: formValues.schoolYear,
          academicZone: formValues.academicZone,
          levels: formValues.levels,
          matiere: formValues.matiere,
          methode: formValues.methode,
          projetAnnuel: formValues.projetAnnuel,
          timetable: formValues.timetable,
        }),
      });

      setGenerationPhase("Enregistrement de la programmation…");

      const data = (await response.json()) as ProgrammationPayload & {
        error?: string;
        details?: string;
        referentielWarning?: string | null;
        failedStep?: string;
      };

      if (!response.ok) {
        setFailedStep(data.failedStep ?? null);
        throw new Error(
          [data.error || "Impossible de générer la programmation.", data.details]
            .filter(Boolean)
            .join(" — "),
        );
      }

      setReferentielWarning(data.referentielWarning ?? null);
      setPayload(data);
      if (data.programmation?.id && typeof window !== "undefined") {
        sessionStorage.setItem(LAST_PROGRAMMATION_KEY, data.programmation.id);
      }
      setGenerationPhase(null);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Impossible de générer la programmation.",
      );
      setGenerationPhase(null);
    } finally {
      setIsGenerating(false);
    }
  }, [formValues]);

  const handleCellChange = useCallback(
    async (tableKey: string, periodNumber: number, cell: ProgrammingCellContent) => {
      if (!payload) return;

      const previousPayload = payload;
      const nextTables = payload.tables.map((table) => {
        if (table.subjectKey !== tableKey) return table;

        return {
          ...table,
          periods: table.periods.map((period) =>
            period.periodNumber === periodNumber ? { ...period, cell } : period,
          ),
        };
      });

      setPayload({ ...payload, tables: nextTables });

      if (cell.id) {
        try {
          const response = await fetch("/api/programmation/cell", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cellId: cell.id, cell }),
          });
          if (!response.ok) {
            const data = (await response.json()) as { error?: string };
            throw new Error(data.error || "Enregistrement de la cellule impossible.");
          }
        } catch (cellError) {
          setPayload(previousPayload);
          setError(
            cellError instanceof Error
              ? cellError.message
              : "Enregistrement de la cellule impossible.",
          );
        }
      }
    },
    [payload],
  );

  const programmationListItems = useMemo<PedagogicalDocumentListItem[]>(
    () =>
      savedProgrammations.map((item) => ({
        id: item.id,
        title: item.title,
        matiere: item.matiere,
        sous_matiere: item.sous_matiere,
        school_year: item.school_year,
        status: item.status,
        created_at: item.created_at,
        source_file_name: item.source_file_name,
        metadata: item.metadata,
        documentType: "Programmation",
      })),
    [savedProgrammations],
  );

  const handleMoveProgrammationSubject = useCallback(
    async (id: string, matiere: string, sousMatiere: string) => {
      const response = await fetch("/api/pedagogical/subject", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType: "programmation",
          entityId: id,
          matiere,
          sousMatiere,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "Impossible de déplacer la programmation.");
        return;
      }
      const listResponse = await fetch("/api/programmation/list");
      if (listResponse.ok) {
        const listData = (await listResponse.json()) as {
          programmations?: typeof savedProgrammations;
        };
        setSavedProgrammations(listData.programmations ?? []);
      }
    },
    [],
  );

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="Programmation annuelle"
        subtitle="Générez une programmation professionnelle basée sur le BO, vos ressources importées, le calendrier scolaire officiel et votre emploi du temps."
        meta={payload ? payload.programmation.title : undefined}
      />

      <PedagogicalModuleToolbar
        importLabel="Importer une programmation"
        onImport={() => setShowImportWizard(true)}
      />

      {savedProgrammations.length > 0 ? (
        <PedagogicalSubjectBrowser
          module="programmation"
          moduleLabel="Programmations"
          documentTypeLabel="Programmations"
          items={programmationListItems}
          selectedId={payload?.programmation.id}
          onSelect={(id) => void loadSavedProgrammation(id)}
          onImport={() => setShowImportWizard(true)}
          onMoveSubject={(id, matiere, sousMatiere) =>
            void handleMoveProgrammationSubject(id, matiere, sousMatiere)
          }
        />
      ) : null}

      {!profileComplete && (
        <FloraCard padding="md" accent="peach">
          <p className="text-sm font-light text-flora-text-muted">
            Complétez votre{" "}
            <Link href="/profil" className="text-[#b88989] underline underline-offset-2">
              profil pédagogique
            </Link>{" "}
            avant de générer une programmation.
          </p>
        </FloraCard>
      )}

      <ProgrammationForm
        values={formValues}
        onChange={(key, value) => setFormValues((current) => ({ ...current, [key]: value }))}
        onGenerate={() => void handleGenerate()}
        isGenerating={isGenerating}
        generationPhase={generationPhase}
        profileComplete={profileComplete}
        onImport={() => setShowImportWizard(true)}
      />

      {showImportWizard ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 p-0 sm:items-center sm:p-4">
          <div className="h-[100dvh] w-full max-w-3xl overflow-y-auto overflow-x-hidden sm:h-auto sm:max-h-[90vh]">
            <ProgrammationImportWizard
              formValues={formValues}
              onComplete={(nextPayload) => {
                setPayload(nextPayload);
                if (nextPayload.programmation?.id && typeof window !== "undefined") {
                  sessionStorage.setItem(LAST_PROGRAMMATION_KEY, nextPayload.programmation.id);
                }
                setShowImportWizard(false);
              }}
              onClose={() => setShowImportWizard(false)}
            />
          </div>
        </div>
      ) : null}

      {referentielWarning ? (
        <FloraCard padding="md" accent="peach">
          <p className="text-sm font-light text-flora-text-muted">
            {referentielWarning}{" "}
            <Link
              href="/bibliotheque"
              className="text-[#b88989] underline underline-offset-2"
            >
              Ouvrir la Bibliothèque documentaire
            </Link>
            .
          </p>
        </FloraCard>
      ) : null}

      <CalendarPreview
        schoolYear={formValues.schoolYear}
        academicZone={formValues.academicZone}
      />

      {error && (
        <FloraCard padding="md" accent="rose">
          <p className="text-sm font-light text-[#b88989]">{error}</p>
          {failedStep ? (
            <p className="mt-2 text-xs font-light text-flora-text-subtle">
              Étape en échec : {failedStep}
            </p>
          ) : null}
          <div className="mt-3">
            <FloraButton
              accent="cream"
              variant="secondary"
              size="sm"
              disabled={isGenerating}
              onClick={() => void handleGenerate()}
            >
              Réessayer
            </FloraButton>
          </div>
        </FloraCard>
      )}

      {payload && (
        <>
          <FloraCard padding="lg" accent="lavender">
            <div className="flex flex-wrap items-center gap-3">
              <FloraBadge accent={payload.validation.valid ? "sage" : "peach"}>
                {payload.validation.valid ? "Validée" : "À corriger"}
              </FloraBadge>
              <p className="text-sm font-light text-flora-text-muted">
                {buildValidationReport(payload.validation)}
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
                        payload.programmation.title || "programmation",
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
                  <FloraButton onClick={() => programmingExporter.exportPayload(payload, "word")}>
                    Exporter Word
                  </FloraButton>
                  <FloraButton
                    variant="secondary"
                    onClick={() => programmingExporter.exportPayload(payload, "excel")}
                  >
                    Exporter Excel
                  </FloraButton>
                  <FloraButton
                    variant="secondary"
                    onClick={() => programmingExporter.exportPayload(payload, "pdf")}
                  >
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

          {viewMode === "faithful" && payload.sourceDocument && payload.programmation.id ? (
            <FloraCard padding="lg" accent="sage">
              <FaithfulSourceTableView
                sourceDocument={payload.sourceDocument}
                entityType="programmation"
                entityId={payload.programmation.id}
                onDocumentChange={(sourceDocument) =>
                  setPayload((current) => (current ? { ...current, sourceDocument } : current))
                }
              />
            </FloraCard>
          ) : (
          <section className="flex flex-col gap-8">
            {payload.tables.map((table) => (
              <ProgrammingTableView
                key={table.subjectKey}
                table={table}
                onCellChange={(tableKey, periodNumber, cell) =>
                  void handleCellChange(tableKey, periodNumber, cell)
                }
              />
            ))}
          </section>
          )}
        </>
      )}

      {!payload && !isGenerating && (
        <FloraCard padding="lg">
          <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Configurez vos paramètres puis cliquez sur « Générer ma programmation ».
          </p>
        </FloraCard>
      )}
    </div>
  );
}
