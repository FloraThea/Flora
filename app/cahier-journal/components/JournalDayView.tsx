"use client";

import Link from "next/link";
import { useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { JournalPayload } from "@/lib/journal/types";
import { colors } from "@/lib/theme";

type Props = {
  payload: JournalPayload;
  onSaveObservation: (entryId: string, patch: Record<string, unknown>) => Promise<void>;
};

export function JournalDayView({ payload, onSaveObservation }: Props) {
  const [savingId, setSavingId] = useState<string | null>(null);

  return (
    <div className="grid gap-4">
      {payload.entries.map((entry) => {
        const differentiation = entry.slotData.differentiation as
          | {
              elevesFragiles?: string[];
              elevesAvances?: string[];
              groupesBesoins?: string[];
              adaptations?: string[];
              variantes?: string[];
            }
          | undefined;

        return (
          <FloraCard
            key={entry.id}
            padding="lg"
            accent={entry.entryType === "ritual" ? "peach" : "lavender"}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <FloraBadge accent="cream">
                    {entry.startTime} – {entry.endTime}
                  </FloraBadge>
                  <FloraBadge accent="lavender">{entry.matiere}</FloraBadge>
                  {entry.entryType === "ritual" ? (
                    <FloraBadge accent="peach">Rituel</FloraBadge>
                  ) : null}
                </div>
                <h3 className="mt-3 font-serif text-xl font-medium">
                  {entry.objectif || entry.ritualLabel}
                </h3>
                {entry.competence ? (
                  <p className="mt-2 text-sm font-light" style={{ color: colors.charcoal.subtle }}>
                    Compétence BO : {entry.competence}
                  </p>
                ) : null}
                {entry.organisation ? (
                  <p className="mt-2 text-sm font-light">{entry.organisation}</p>
                ) : null}
                {entry.materiel.items.length > 0 ? (
                  <p className="mt-2 text-sm font-light">
                    Matériel : {entry.materiel.items.join(", ")}
                  </p>
                ) : null}
                {entry.documents.length > 0 ? (
                  <p className="mt-2 text-sm font-light">
                    Supports : {entry.documents.join(", ")}
                  </p>
                ) : null}
                {differentiation?.groupesBesoins?.length ? (
                  <p className="mt-2 text-sm font-light text-sauge">
                    Groupes : {differentiation.groupesBesoins.join(", ")}
                  </p>
                ) : null}
                {differentiation?.adaptations?.length ? (
                  <p className="mt-2 text-sm font-light">
                    Différenciation : {differentiation.adaptations.join(" · ")}
                  </p>
                ) : null}
              </div>

              {entry.seanceId ? (
                <Link href={`/seances?seanceId=${entry.seanceId}`}>
                  <FloraButton accent="sage" variant="secondary">
                    Ouvrir la séance
                  </FloraButton>
                </Link>
              ) : null}
            </div>

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
              <label className="flex flex-col gap-1 text-sm">
                Temps réel (min)
                <input
                  type="number"
                  defaultValue={entry.observation?.actualMinutes ?? entry.dureeMinutes}
                  className="rounded-xl border border-white/70 bg-white/60 px-3 py-2"
                  onBlur={async (event) => {
                    setSavingId(entry.id);
                    await onSaveObservation(entry.id, {
                      status: entry.observation?.status ?? "realisee",
                      actualMinutes: Number(event.target.value),
                    });
                    setSavingId(null);
                  }}
                />
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                Difficultés
                <textarea
                  defaultValue={entry.observation?.difficulties ?? ""}
                  className="min-h-16 rounded-xl border border-white/70 bg-white/60 px-3 py-2"
                  onBlur={async (event) => {
                    setSavingId(entry.id);
                    await onSaveObservation(entry.id, {
                      status: entry.observation?.status ?? "realisee",
                      difficulties: event.target.value,
                    });
                    setSavingId(null);
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Réussites
                <textarea
                  defaultValue={entry.observation?.successes ?? ""}
                  className="min-h-16 rounded-xl border border-white/70 bg-white/60 px-3 py-2"
                  onBlur={async (event) => {
                    setSavingId(entry.id);
                    await onSaveObservation(entry.id, {
                      status: entry.observation?.status ?? "realisee",
                      successes: event.target.value,
                    });
                    setSavingId(null);
                  }}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Suite à donner
                <textarea
                  defaultValue={entry.observation?.followUp ?? ""}
                  className="min-h-16 rounded-xl border border-white/70 bg-white/60 px-3 py-2"
                  onBlur={async (event) => {
                    setSavingId(entry.id);
                    await onSaveObservation(entry.id, {
                      status: entry.observation?.status ?? "realisee",
                      followUp: event.target.value,
                    });
                    setSavingId(null);
                  }}
                />
              </label>
            </div>

            {savingId === entry.id ? (
              <p className="mt-2 text-xs font-light text-sauge">Enregistrement…</p>
            ) : null}
          </FloraCard>
        );
      })}
    </div>
  );
}
