"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import { PedagogicalModuleToolbar } from "@/components/pedagogical/PedagogicalModuleToolbar";
import { PedagogicalSubjectBrowser } from "@/components/pedagogical/PedagogicalSubjectBrowser";
import type { PedagogicalDocumentListItem } from "@/components/pedagogical/PedagogicalDocumentCard";
import type { SequencePayload } from "@/lib/sequences/types";
import { colors } from "@/lib/theme";
import { PedagogicalStartMenu } from "@/components/pedagogical/PedagogicalStartMenu";
import { SequenceCard } from "./SequenceCard";
import { SequenceDetailModal } from "./SequenceDetailModal";
import { IndependentSequenceForm } from "./IndependentSequenceForm";
import {
  initialSequencesFormValues,
  type ProgressionRowOption,
  type SequenceCardSummary,
  type SequencesFormValues,
  type ValidatedProgressionSummary,
} from "../types";

export function SequencesPage() {
  return (
    <Suspense fallback={<p className="text-sm font-light text-flora-text-subtle">Chargement…</p>}>
      <SequencesPageContent />
    </Suspense>
  );
}

function SequencesPageContent() {
  const searchParams = useSearchParams();
  const [formValues, setFormValues] = useState<SequencesFormValues>(initialSequencesFormValues);
  const [progressions, setProgressions] = useState<ValidatedProgressionSummary[]>([]);
  const [rows, setRows] = useState<ProgressionRowOption[]>([]);
  const [sequences, setSequences] = useState<SequenceCardSummary[]>([]);
  const [selectedPayload, setSelectedPayload] = useState<SequencePayload | null>(null);
  const [generatingRowId, setGeneratingRowId] = useState<string | null>(null);
  const [isLoadingProgressions, setIsLoadingProgressions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowMode, setFlowMode] = useState<null | "linked" | "independent">(null);
  const [allSequences, setAllSequences] = useState<
    Array<Record<string, unknown>>
  >([]);

  const loadAllSequences = useCallback(async () => {
    const response = await fetch("/api/sequences/list?all=true");
    const data = (await response.json()) as { sequences?: Array<Record<string, unknown>>; error?: string };
    if (!response.ok) throw new Error(data.error || "Impossible de charger les séquences.");
    setAllSequences(data.sequences ?? []);
  }, []);

  useEffect(() => {
    void loadAllSequences().catch(() => undefined);
  }, [loadAllSequences]);

  const loadSequences = useCallback(async (progressionId: string) => {
    const response = await fetch(`/api/sequences/list?progressionId=${progressionId}`);
    const data = (await response.json()) as {
      sequences?: SequenceCardSummary[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger les séquences.");
    }

    setSequences(data.sequences ?? []);
  }, []);

  const loadRows = useCallback(async (progressionId: string) => {
    const response = await fetch(`/api/sequences/rows?progressionId=${progressionId}`);
    const data = (await response.json()) as {
      rows?: ProgressionRowOption[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger les lignes.");
    }

    setRows(data.rows ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProgressions() {
      setIsLoadingProgressions(true);

      try {
        const response = await fetch("/api/sequences/progressions");
        const data = (await response.json()) as {
          progressions?: ValidatedProgressionSummary[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Impossible de charger les progressions.");
        }

        if (!cancelled) {
          const items = data.progressions ?? [];
          setProgressions(items);
          if (items[0]) {
            setFormValues({ progressionId: items[0].id });
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger les progressions.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProgressions(false);
        }
      }
    }

    void loadProgressions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!formValues.progressionId) return;

    let cancelled = false;

    async function refresh() {
      try {
        await Promise.all([
          loadRows(formValues.progressionId),
          loadSequences(formValues.progressionId),
        ]);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Impossible de charger la progression sélectionnée.",
          );
        }
      }
    }

    void refresh();

    return () => {
      cancelled = true;
    };
  }, [formValues.progressionId, loadRows, loadSequences]);

  const handleGenerate = useCallback(
    async (progressionRowId: string) => {
      setGeneratingRowId(progressionRowId);
      setError(null);

      try {
        const response = await fetch("/api/sequences/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progressionRowId }),
        });

        const data = (await response.json()) as SequencePayload & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Impossible de générer la séquence.");
        }

        await Promise.all([
          loadRows(formValues.progressionId),
          loadSequences(formValues.progressionId),
        ]);

        setSelectedPayload(data);
      } catch (generateError) {
        setError(
          generateError instanceof Error
            ? generateError.message
            : "Impossible de générer la séquence.",
        );
      } finally {
        setGeneratingRowId(null);
      }
    },
    [formValues.progressionId, loadRows, loadSequences],
  );

  const openSequence = useCallback(async (sequenceId: string) => {
    const response = await fetch(`/api/sequences/details?id=${sequenceId}`);
    const data = (await response.json()) as SequencePayload & { error?: string };

    if (!response.ok || !data.sequence) {
      setError(data.error || "Impossible d'ouvrir la séquence.");
      return;
    }

    setSelectedPayload(data);
  }, []);

  useEffect(() => {
    const sequenceId = searchParams.get("id");
    if (!sequenceId) return;
    void openSequence(sequenceId);
  }, [openSequence, searchParams]);

  const selectedProgression = progressions.find((item) => item.id === formValues.progressionId);

  const sequenceListItems = useMemo<PedagogicalDocumentListItem[]>(
    () =>
      allSequences.map((row) => ({
        id: String(row.id),
        title: String(row.title ?? ""),
        matiere: String(row.matiere ?? ""),
        sous_matiere: String(row.sous_matiere ?? ""),
        niveau: String(row.niveau ?? ""),
        status: String(row.status ?? ""),
        created_at: String(row.created_at ?? ""),
        metadata: row.metadata,
        documentType: "Séquence",
      })),
    [allSequences],
  );

  const handleMoveSequenceSubject = useCallback(
    async (id: string, matiere: string, sousMatiere: string) => {
      await fetch("/api/pedagogical/subject", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "sequence", entityId: id, matiere, sousMatiere }),
      });
      await loadAllSequences();
    },
    [loadAllSequences],
  );

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="Séquences pédagogiques"
        subtitle="Créez une séquence depuis une progression ou de façon indépendante."
        meta={selectedProgression?.title}
        action={
          <Link
            href="/progression"
            className="rounded-2xl border border-white/70 bg-white/50 px-4 py-2 text-sm font-light text-flora-text-muted transition hover:bg-white/80"
          >
            Voir la progression
          </Link>
        }
      />

      <PedagogicalModuleToolbar
        importLabel="Importer une séquence"
        onImport={() => setFlowMode("independent")}
        onCreateManual={() => setFlowMode("independent")}
      />

      {allSequences.length > 0 ? (
        <PedagogicalSubjectBrowser
          module="sequence"
          moduleLabel="Séquences"
          documentTypeLabel="Séquences"
          items={sequenceListItems}
          selectedId={selectedPayload?.sequence.id}
          onSelect={(id) => void openSequence(id)}
          onImport={() => setFlowMode("independent")}
          onCreateManual={() => setFlowMode("independent")}
          onMoveSubject={(id, matiere, sousMatiere) =>
            void handleMoveSequenceSubject(id, matiere, sousMatiere)
          }
        />
      ) : null}

      {!flowMode ? (
        <PedagogicalStartMenu
          moduleTitle="Que souhaitez-vous faire ?"
          moduleSubtitle="Une séquence peut exister seule ou être générée depuis une progression."
          options={[
            {
              id: "independent",
              title: "Créer une séquence indépendante",
              description: "Titre, matière, compétences et séances sans progression préalable.",
              badge: "Indépendante",
              onSelect: () => setFlowMode("independent"),
            },
            {
              id: "import",
              title: "Importer une séquence",
              description: "Excel, PDF ou JPG — bientôt disponible dans l'assistant d'import.",
              disabled: true,
              onSelect: () => setFlowMode("independent"),
            },
            {
              id: "from-progression",
              title: "Créer depuis une progression",
              description: "Générer automatiquement à partir d'une ligne de progression validée.",
              badge: "Liée",
              onSelect: () => setFlowMode("linked"),
              disabled: progressions.length === 0 && !isLoadingProgressions,
            },
          ]}
        />
      ) : null}

      {flowMode === "independent" ? (
        <IndependentSequenceForm
          onCreated={(payload) => {
            setSelectedPayload(payload);
            setFlowMode(null);
            setError(null);
          }}
          onCancel={() => setFlowMode(null)}
        />
      ) : null}

      {flowMode === "linked" ? (
      <>
      <FloraCard padding="lg" accent="rose">
        <label className="block">
          <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
            Progression validée
          </span>
          <select
            value={formValues.progressionId}
            onChange={(event) => setFormValues({ progressionId: event.target.value })}
            disabled={isLoadingProgressions || progressions.length === 0}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          >
            <option value="">
              {progressions.length === 0
                ? "Aucune progression validée disponible"
                : "Choisir une progression"}
            </option>
            {progressions.map((progression) => (
              <option key={progression.id} value={progression.id}>
                {progression.title} ({progression.rowCount} lignes)
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

      {rows.length > 0 && (
        <FloraCard padding="lg" accent="lavender">
          <h3 className="mb-4 font-serif text-xl text-flora-text">Lignes de progression</h3>
          <div className="grid gap-3">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/55 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <FloraBadge accent="lavender">
                      {row.subSubjectLabel || row.subjectLabel}
                    </FloraBadge>
                    <FloraBadge accent="cream">
                      P{row.periodNumber} · S{row.weekNumber}
                    </FloraBadge>
                    {row.hasSequence && <FloraBadge accent="sage">Séquence créée</FloraBadge>}
                  </div>
                  <p className="text-sm font-light text-flora-text-muted">
                    {row.sequenceModule} · {row.competenceBo || row.seanceLabel}
                  </p>
                </div>
                <FloraButton
                  disabled={row.hasSequence || generatingRowId === row.id}
                  onClick={() => void handleGenerate(row.id)}
                >
                  {generatingRowId === row.id ? "Génération…" : "Générer la séquence"}
                </FloraButton>
              </div>
            ))}
          </div>
        </FloraCard>
      )}

      {sequences.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sequences.map((sequence, index) => (
            <SequenceCard
              key={sequence.id}
              sequence={sequence}
              index={index}
              onClick={() => void openSequence(sequence.id)}
            />
          ))}
        </section>
      ) : (
        <FloraCard padding="lg">
          <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Sélectionnez une progression validée, puis générez une séquence à partir d&apos;une ligne.
          </p>
        </FloraCard>
      )}

      <FloraButton variant="ghost" onClick={() => setFlowMode(null)}>
        ← Retour au menu
      </FloraButton>
      </>
      ) : null}

      {selectedPayload && (
        <SequenceDetailModal
          payload={selectedPayload}
          onClose={() => setSelectedPayload(null)}
        />
      )}
    </div>
  );
}
