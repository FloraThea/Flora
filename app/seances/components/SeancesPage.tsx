"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraPageTitle } from "@/components/ui/FloraPageTitle";
import type { SeanceCardSummary, SeancePayload, SeanceViewMode } from "@/lib/seances/types";
import { colors } from "@/lib/theme";
import { PedagogicalStartMenu } from "@/components/pedagogical/PedagogicalStartMenu";
import { IndependentSeanceForm } from "./IndependentSeanceForm";
import { SeanceCard } from "./SeanceCard";
import { SeanceDetailModal } from "./SeanceDetailModal";
import {
  initialSeancesFormValues,
  VIEW_MODE_OPTIONS,
  type SequenceSessionOption,
  type SequenceWithSeancesSummary,
} from "../types";

export function SeancesPage() {
  const [formValues, setFormValues] = useState(initialSeancesFormValues);
  const [sequences, setSequences] = useState<SequenceWithSeancesSummary[]>([]);
  const [sessions, setSessions] = useState<SequenceSessionOption[]>([]);
  const [seances, setSeances] = useState<SeanceCardSummary[]>([]);
  const [selectedPayload, setSelectedPayload] = useState<SeancePayload | null>(null);
  const [viewMode, setViewMode] = useState<SeanceViewMode>("cards");
  const [generatingSessionId, setGeneratingSessionId] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isLoadingSequences, setIsLoadingSequences] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flowMode, setFlowMode] = useState<null | "menu" | "linked" | "independent">("menu");
  const [independentSeances, setIndependentSeances] = useState<SeanceCardSummary[]>([]);

  const loadSessions = useCallback(async (sequenceId: string) => {
    const response = await fetch(`/api/seances/sessions?sequenceId=${sequenceId}`);
    const data = (await response.json()) as {
      sessions?: SequenceSessionOption[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger les sessions.");
    }

    setSessions(data.sessions ?? []);
  }, []);

  const loadSeances = useCallback(async (sequenceId: string) => {
    const response = await fetch(`/api/seances/list?sequenceId=${sequenceId}`);
    const data = (await response.json()) as {
      seances?: SeanceCardSummary[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger les séances.");
    }

    setSeances(data.seances ?? []);
  }, []);

  const loadIndependentSeances = useCallback(async () => {
    const response = await fetch("/api/seances/list?independent=true");
    const data = (await response.json()) as {
      seances?: SeanceCardSummary[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger les séances indépendantes.");
    }

    setIndependentSeances(data.seances ?? []);
  }, []);

  useEffect(() => {
    void loadIndependentSeances().catch(() => undefined);
  }, [loadIndependentSeances]);

  useEffect(() => {
    if (flowMode !== "linked") return;

    let cancelled = false;

    async function bootstrap() {
      setIsLoadingSequences(true);

      try {
        const response = await fetch("/api/seances/sequences");
        const data = (await response.json()) as {
          sequences?: SequenceWithSeancesSummary[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error || "Impossible de charger les séquences.");
        }

        if (!cancelled) {
          const items = data.sequences ?? [];
          setSequences(items);
          if (items[0]) {
            setFormValues({ sequenceId: items[0].id });
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Erreur de chargement.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingSequences(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [flowMode]);

  useEffect(() => {
    if (!formValues.sequenceId) return;

    let cancelled = false;

    async function refresh() {
      try {
        await Promise.all([
          loadSessions(formValues.sequenceId),
          loadSeances(formValues.sequenceId),
        ]);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Erreur de chargement.");
        }
      }
    }

    void refresh();

    return () => {
      cancelled = true;
    };
  }, [formValues.sequenceId, loadSessions, loadSeances]);

  const handleGenerateSession = useCallback(
    async (sequenceSessionId: string) => {
      setGeneratingSessionId(sequenceSessionId);
      setError(null);

      try {
        const response = await fetch("/api/seances/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sequenceSessionId }),
        });

        const data = (await response.json()) as SeancePayload & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Impossible de générer la séance.");
        }

        await Promise.all([
          loadSessions(formValues.sequenceId),
          loadSeances(formValues.sequenceId),
        ]);

        setSelectedPayload(data);
      } catch (generateError) {
        setError(
          generateError instanceof Error ? generateError.message : "Impossible de générer.",
        );
      } finally {
        setGeneratingSessionId(null);
      }
    },
    [formValues.sequenceId, loadSessions, loadSeances],
  );

  const handleGenerateAll = useCallback(async () => {
    if (!formValues.sequenceId) return;

    setIsGeneratingAll(true);
    setError(null);

    try {
      const response = await fetch("/api/seances/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId: formValues.sequenceId }),
      });

      const data = (await response.json()) as {
        payloads?: SeancePayload[];
        count?: number;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Impossible de générer les séances.");
      }

      await Promise.all([
        loadSessions(formValues.sequenceId),
        loadSeances(formValues.sequenceId),
      ]);

      if (data.payloads?.[0]) {
        setSelectedPayload(data.payloads[0]);
      }
    } catch (generateError) {
      setError(
        generateError instanceof Error ? generateError.message : "Impossible de générer.",
      );
    } finally {
      setIsGeneratingAll(false);
    }
  }, [formValues.sequenceId, loadSessions, loadSeances]);

  const openSeance = useCallback(async (seanceId: string) => {
    const response = await fetch(`/api/seances/details?id=${seanceId}`);
    const data = (await response.json()) as SeancePayload & { error?: string };

    if (!response.ok || !data.seance) {
      setError(data.error || "Impossible d'ouvrir la séance.");
      return;
    }

    setSelectedPayload(data);
  }, []);

  const sortedSeances = useMemo(() => {
    const copy = [...seances];

    switch (viewMode) {
      case "chrono":
        return copy.sort((a, b) => a.sessionNumber - b.sessionNumber);
      case "matiere":
        return copy.sort((a, b) => a.matiere.localeCompare(b.matiere));
      case "week":
        return copy.sort((a, b) => a.weekNumber - b.weekNumber || a.sessionNumber - b.sessionNumber);
      case "sequence":
        return copy.sort((a, b) => a.sessionNumber - b.sessionNumber);
      case "list":
      case "cards":
      default:
        return copy.sort((a, b) => a.sessionNumber - b.sessionNumber);
    }
  }, [seances, viewMode]);

  const selectedSequence = sequences.find((item) => item.id === formValues.sequenceId);
  const pendingCount = sessions.filter((session) => !session.hasSeance).length;

  return (
    <div className="flex flex-col gap-8">
      <FloraPageTitle
        title="Séances pédagogiques"
        subtitle="Créez une séance seule ou générez-la depuis une séquence existante."
        meta={selectedSequence?.title}
        action={
          <Link
            href="/sequences"
            className="rounded-2xl border border-white/70 bg-white/50 px-4 py-2 text-sm font-light text-flora-text-muted transition hover:bg-white/80"
          >
            Voir les séquences
          </Link>
        }
      />

      {flowMode === "menu" ? (
        <PedagogicalStartMenu
          moduleTitle="Que souhaitez-vous faire ?"
          moduleSubtitle="Une séance peut exister seule ou être générée depuis une séquence."
          options={[
            {
              id: "independent",
              title: "Créer une séance indépendante",
              description: "Date, matière, objectif et déroulement sans séquence préalable.",
              badge: "Indépendante",
              onSelect: () => setFlowMode("independent"),
            },
            {
              id: "import",
              title: "Importer une séance",
              description: "Excel, PDF ou JPG — bientôt disponible.",
              disabled: true,
              onSelect: () => undefined,
            },
            {
              id: "from-sequence",
              title: "Créer depuis une séquence",
              description: "Générer automatiquement à partir d'une session de séquence.",
              badge: "Liée",
              onSelect: () => setFlowMode("linked"),
            },
            {
              id: "journal",
              title: "Ajouter au cahier journal",
              description: "Créez une séance indépendante puis ouvrez le cahier journal.",
              onSelect: () => setFlowMode("independent"),
            },
          ]}
        />
      ) : null}

      {flowMode === "independent" ? (
        <IndependentSeanceForm
          onCreated={(payload) => {
            setSelectedPayload(payload);
            setFlowMode("menu");
            void loadIndependentSeances();
            setError(null);
          }}
          onCancel={() => setFlowMode("menu")}
        />
      ) : null}

      {flowMode === "linked" ? (
        <FloraButton variant="ghost" onClick={() => setFlowMode("menu")}>
          ← Retour au menu
        </FloraButton>
      ) : null}

      {independentSeances.length > 0 && flowMode === "menu" ? (
        <FloraCard padding="lg" accent="lavender">
          <h3 className="mb-4 font-serif text-xl text-flora-text">Séances indépendantes</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {independentSeances.map((seance) => (
              <button
                key={seance.id}
                type="button"
                onClick={() => void openSeance(seance.id)}
                className="rounded-2xl border border-white/70 bg-white/55 p-4 text-left hover:bg-white/75"
              >
                <p className="font-medium text-flora-text">{seance.title}</p>
                <p className="mt-1 text-sm font-light text-flora-text-muted">
                  {seance.matiere} · {seance.dureeMinutes} min
                </p>
              </button>
            ))}
          </div>
        </FloraCard>
      ) : null}

      {flowMode === "linked" ? (
      <>
      <FloraCard padding="lg" accent="rose">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
              Séquence validée
            </span>
            <select
              value={formValues.sequenceId}
              onChange={(event) => setFormValues({ sequenceId: event.target.value })}
              disabled={isLoadingSequences || sequences.length === 0}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
            >
              <option value="">
                {sequences.length === 0
                  ? "Aucune séquence disponible"
                  : "Choisir une séquence"}
              </option>
              {sequences.map((sequence) => (
                <option key={sequence.id} value={sequence.id}>
                  {sequence.title} ({sequence.seanceCount}/{sequence.sessionCount} séances)
                </option>
              ))}
            </select>
          </label>

          <FloraButton
            disabled={!formValues.sequenceId || pendingCount === 0 || isGeneratingAll}
            onClick={() => void handleGenerateAll()}
          >
            {isGeneratingAll
              ? "Génération…"
              : `Générer toutes les séances (${pendingCount})`}
          </FloraButton>
        </div>
      </FloraCard>

      <FloraCard padding="md" accent="cream">
        <div className="flex flex-wrap gap-2">
          {VIEW_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setViewMode(option.value)}
              className={`rounded-2xl px-4 py-2 text-sm font-light transition ${
                viewMode === option.value
                  ? "bg-rose-poudre/40 text-flora-text"
                  : "bg-white/45 text-flora-text-muted hover:bg-white/70"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </FloraCard>

      {error && (
        <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm font-light text-[#b88989]">
          {error}
        </p>
      )}

      {sessions.length > 0 && (
        <FloraCard padding="lg" accent="lavender">
          <h3 className="mb-4 font-serif text-xl text-flora-text">Sessions de la séquence</h3>
          <div className="grid gap-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/70 bg-white/55 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <FloraBadge accent="lavender">Séance {session.sessionNumber}</FloraBadge>
                    <FloraBadge accent="cream">{session.dureeMinutes} min</FloraBadge>
                    {session.hasSeance && <FloraBadge accent="sage">Séance créée</FloraBadge>}
                  </div>
                  <p className="text-sm font-light text-flora-text-muted">{session.title}</p>
                  <p className="text-sm font-light text-flora-text-subtle">{session.objectif}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {session.hasSeance && session.seanceId ? (
                    <FloraButton variant="secondary" onClick={() => void openSeance(session.seanceId!)}>
                      Ouvrir
                    </FloraButton>
                  ) : (
                    <FloraButton
                      disabled={generatingSessionId === session.id}
                      onClick={() => void handleGenerateSession(session.id)}
                    >
                      {generatingSessionId === session.id ? "Génération…" : "Générer la séance"}
                    </FloraButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </FloraCard>
      )}

      {sortedSeances.length > 0 ? (
        viewMode === "list" ? (
          <FloraCard padding="lg">
            <div className="grid gap-3">
              {sortedSeances.map((seance) => (
                <button
                  key={seance.id}
                  type="button"
                  onClick={() => void openSeance(seance.id)}
                  className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/50 px-4 py-3 text-left hover:bg-white/70"
                >
                  <span className="text-sm font-light text-flora-text">
                    S{seance.sessionNumber} · {seance.title}
                  </span>
                  <span className="text-xs font-light text-flora-text-subtle">{seance.dureeMinutes} min</span>
                </button>
              ))}
            </div>
          </FloraCard>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedSeances.map((seance, index) => (
              <SeanceCard
                key={seance.id}
                seance={seance}
                index={index}
                onClick={() => void openSeance(seance.id)}
              />
            ))}
          </section>
        )
      ) : (
        <FloraCard padding="lg">
          <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
            Sélectionnez une séquence, puis générez les séances détaillées à partir de ses sessions.
          </p>
        </FloraCard>
      )}

      </>
      ) : null}

      {selectedPayload && (
        <SeanceDetailModal
          payload={selectedPayload}
          onClose={() => setSelectedPayload(null)}
          onUpdated={setSelectedPayload}
        />
      )}
    </div>
  );
}
