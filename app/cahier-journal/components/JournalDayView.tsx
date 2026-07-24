"use client";

import Link from "next/link";
import { useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { JournalEntry, JournalPayload } from "@/lib/journal/types";

type Props = {
  payload: JournalPayload;
  onSaveObservation: (entryId: string, patch: Record<string, unknown>) => Promise<void>;
  onCompleteEntry?: (entry: JournalEntry) => void;
  onGenerateEntry?: (entry: JournalEntry) => Promise<void>;
  onCreateManualDay?: () => Promise<void>;
  generatingEntryId?: string | null;
};

function fillStateLabel(entry: JournalEntry): string {
  const state = String(entry.metadata.fillState ?? "empty");
  if (state === "generated") return "Contenu généré";
  if (state === "manual") return "Complété manuellement";
  if (state === "linked") return "Lié à une séance importée";
  if (state === "missing") return "Séance non importée";
  if (state === "break") return "";
  return "Aucun contenu pédagogique ajouté";
}

export function JournalDayView({
  payload,
  onSaveObservation,
  onCompleteEntry,
  onGenerateEntry,
  onCreateManualDay,
  generatingEntryId,
}: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creatingManual, setCreatingManual] = useState(false);
  const isPreview = payload.preview === true;
  const isBreak = (entry: JournalEntry) => entry.entryType === "break";
  const hasTimetable = payload.hasTimetable === true;
  const isManualDay = payload.journal.metadata?.manualDay === true;
  const showEmptyState = !hasTimetable && !isManualDay;

  return (
    <div className="grid w-full max-w-full gap-4 overflow-x-hidden">
      {payload.specialDayMessage && !showEmptyState ? (
        <FloraCard padding="md" accent="cream">
          <p className="text-sm font-light text-flora-text-subtle">{payload.specialDayMessage}</p>
        </FloraCard>
      ) : null}

      {showEmptyState ? (
        <FloraCard padding="lg" accent="lavender">
          <p className="font-serif text-xl font-medium">Aucun emploi du temps disponible.</p>
          <div className="mt-4 flex w-full max-w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link href="/emploi-du-temps" className="w-full sm:w-auto">
              <FloraButton accent="sage" className="!w-full sm:!w-auto">
                Créer mon emploi du temps
              </FloraButton>
            </Link>
            <Link href="/emploi-du-temps?import=1" className="w-full sm:w-auto">
              <FloraButton accent="lavender" variant="secondary" className="!w-full sm:!w-auto">
                Importer un emploi du temps
              </FloraButton>
            </Link>
            <FloraButton
              accent="cream"
              variant="secondary"
              className="!w-full sm:!w-auto"
              disabled={creatingManual || !onCreateManualDay}
              onClick={() => {
                if (!onCreateManualDay) return;
                setCreatingManual(true);
                void onCreateManualDay().finally(() => setCreatingManual(false));
              }}
            >
              {creatingManual ? "Création…" : "Créer une journée manuellement"}
            </FloraButton>
          </div>
        </FloraCard>
      ) : null}

      {!showEmptyState
        ? payload.entries.map((entry) => {
        const subSubject = String(entry.slotData.subSubject ?? "");
        const customText = String(entry.slotData.customText ?? "");
        const fillState = fillStateLabel(entry);

        if (isBreak(entry)) {
          return (
            <FloraCard key={entry.id} padding="md" accent="peach">
              <FloraBadge accent="cream">
                {entry.startTime} – {entry.endTime}
              </FloraBadge>
              <h3 className="mt-2 font-serif text-lg font-medium">{entry.matiere}</h3>
            </FloraCard>
          );
        }

        const fillStateKey = String(entry.metadata.fillState ?? "empty");
        const hasContent =
          fillStateKey === "linked" ||
          fillStateKey === "manual" ||
          Boolean(
            (entry.competence || entry.organisation) &&
              fillStateKey !== "missing",
          );
        const isGenerating = generatingEntryId === entry.id;

        return (
          <FloraCard
            key={entry.id}
            padding="lg"
            accent={entry.entryType === "ritual" ? "peach" : "lavender"}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <FloraBadge accent="cream">
                    {entry.startTime} – {entry.endTime}
                  </FloraBadge>
                  <FloraBadge accent="lavender">{entry.matiere}</FloraBadge>
                  {subSubject ? <FloraBadge accent="sage">{subSubject}</FloraBadge> : null}
                  {customText ? <FloraBadge accent="cream">{customText}</FloraBadge> : null}
                </div>

                <h3 className="mt-3 font-serif text-xl font-medium">{entry.matiere}</h3>
                {customText ? (
                  <p className="mt-1 text-sm font-light text-flora-text-subtle">{customText}</p>
                ) : null}

                {fillState ? (
                  <p className="mt-2 text-sm font-light text-flora-text-subtle">{fillState}</p>
                ) : null}

                {entry.competence ? (
                  <p className="mt-2 text-sm font-light">Compétence : {entry.competence}</p>
                ) : null}
                {entry.objectif ? (
                  <p className="mt-2 text-sm font-light">Objectif : {entry.objectif}</p>
                ) : null}
                {entry.organisation ? (
                  <p className="mt-2 text-sm font-light">Déroulement : {entry.organisation}</p>
                ) : null}
                {entry.materiel.items.length > 0 ? (
                  <p className="mt-2 text-sm font-light">
                    Matériel : {entry.materiel.items.join(", ")}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                {fillStateKey === "missing" ? (
                  <Link href="/seances">
                    <FloraButton accent="lavender" variant="secondary">
                      Importer une séance
                    </FloraButton>
                  </Link>
                ) : !hasContent ? (
                  <FloraButton
                    accent="lavender"
                    variant="secondary"
                    onClick={() => onCompleteEntry?.(entry)}
                  >
                    Compléter manuellement
                  </FloraButton>
                ) : (
                  <FloraButton
                    accent="lavender"
                    variant="secondary"
                    onClick={() => onCompleteEntry?.(entry)}
                  >
                    Modifier
                  </FloraButton>
                )}
                {entry.seanceId ? (
                  <Link href={`/seances?seanceId=${entry.seanceId}`}>
                    <FloraButton accent="sage" variant="secondary">
                      Ouvrir la séance
                    </FloraButton>
                  </Link>
                ) : null}
              </div>
            </div>

            {!isPreview && entry.id && !entry.id.startsWith("preview-") ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm">
                  Statut
                  <select
                    defaultValue={entry.observation?.status ?? "realisee"}
                    className="rounded-xl border border-white/70 bg-white/60 px-3 py-2"
                    onChange={async (event) => {
                      setSavingId(entry.id);
                      await onSaveObservation(entry.id, { status: event.target.value });
                      setSavingId(null);
                    }}
                  >
                    <option value="realisee">Réalisée</option>
                    <option value="partielle">Partiellement réalisée</option>
                    <option value="non_realisee">Non réalisée</option>
                  </select>
                </label>
              </div>
            ) : null}

            {savingId === entry.id ? (
              <p className="mt-2 text-xs font-light text-sauge">Enregistrement…</p>
            ) : null}
          </FloraCard>
        );
      })
        : null}
    </div>
  );
}
