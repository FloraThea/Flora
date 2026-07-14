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
  generatingEntryId?: string | null;
};

function fillStateLabel(entry: JournalEntry): string {
  const state = String(entry.metadata.fillState ?? "empty");
  if (state === "generated") return "Contenu généré";
  if (state === "manual") return "Complété manuellement";
  if (state === "linked") return "Lié à une séance existante";
  if (state === "break") return "";
  return "Aucun contenu pédagogique ajouté";
}

export function JournalDayView({
  payload,
  onSaveObservation,
  onCompleteEntry,
  onGenerateEntry,
  generatingEntryId,
}: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);
  const isPreview = payload.preview === true;
  const isBreak = (entry: JournalEntry) => entry.entryType === "break";

  return (
    <div className="grid gap-4">
      {payload.specialDayMessage ? (
        <FloraCard padding="md" accent="cream">
          <p className="text-sm font-light text-flora-text-subtle">{payload.specialDayMessage}</p>
        </FloraCard>
      ) : null}

      {!payload.hasTimetable ? (
        <FloraCard padding="lg" accent="lavender">
          <p className="font-serif text-xl font-medium">Aucun emploi du temps disponible</p>
          <p className="mt-2 text-sm font-light text-flora-text-subtle">
            Créez ou importez votre emploi du temps pour générer automatiquement les plages
            horaires de votre cahier journal.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/emploi-du-temps">
              <FloraButton accent="sage">Créer mon emploi du temps</FloraButton>
            </Link>
            <Link href="/emploi-du-temps">
              <FloraButton accent="lavender" variant="secondary">
                Importer un emploi du temps
              </FloraButton>
            </Link>
          </div>
        </FloraCard>
      ) : null}

      {payload.entries.map((entry) => {
        const subSubject = String(entry.slotData.subSubject ?? "");
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

        const hasContent = Boolean(entry.objectif || entry.competence || entry.organisation);
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
                </div>

                <h3 className="mt-3 font-serif text-xl font-medium">{entry.matiere}</h3>

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
                {!hasContent ? (
                  <>
                    <FloraButton
                      accent="lavender"
                      variant="secondary"
                      onClick={() => onCompleteEntry?.(entry)}
                    >
                      Compléter
                    </FloraButton>
                    <FloraButton
                      accent="sage"
                      disabled={isGenerating}
                      onClick={() => void onGenerateEntry?.(entry)}
                    >
                      {isGenerating ? "Génération…" : "Générer"}
                    </FloraButton>
                  </>
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
      })}
    </div>
  );
}
