"use client";

import { useEffect, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { JournalEntry } from "@/lib/journal/types";

type Props = {
  entry: JournalEntry;
  date: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

const inputClassName =
  "w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm font-light outline-none focus:border-rose-poudre/50";

function splitLines(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function JournalEntryCompleteModal({ entry, date, onClose, onSaved }: Props) {
  const [startTime, setStartTime] = useState(entry.startTime);
  const [endTime, setEndTime] = useState(entry.endTime);
  const [matiere, setMatiere] = useState(entry.matiere);
  const [subSubject, setSubSubject] = useState(String(entry.slotData.subSubject ?? ""));
  const [competence, setCompetence] = useState(entry.competence);
  const [objectif, setObjectif] = useState(entry.objectif);
  const [organisation, setOrganisation] = useState(entry.organisation);
  const [materielText, setMaterielText] = useState(entry.materiel.items.join(", "));
  const [resourcesText, setResourcesText] = useState(
    [
      ...entry.resources.documents,
      ...entry.resources.guides,
      ...entry.resources.fiches,
      ...entry.resources.liens,
    ].join(", "),
  );
  const [observations, setObservations] = useState(entry.observations);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/cahier-journal/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          date,
          entryRef: {
            entryId: entry.id,
            sortOrder: entry.sortOrder,
            startTime: entry.startTime,
            matiere: entry.matiere,
          },
          startTime,
          endTime,
          matiere,
          subSubject,
          competence,
          objectif,
          organisation,
          materielItems: splitLines(materielText),
          resourceItems: splitLines(resourcesText),
          observations,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Enregistrement impossible.");

      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erreur d'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <FloraCard
        padding="lg"
        accent="lavender"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-medium">Compléter le créneau</h2>
            <p className="mt-1 text-sm font-light text-flora-text-subtle">
              {entry.matiere} · {entry.startTime} – {entry.endTime}
            </p>
          </div>
          <FloraButton accent="cream" variant="secondary" onClick={onClose}>
            Fermer
          </FloraButton>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Début
            <input
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Fin
            <input
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Matière
            <input
              value={matiere}
              onChange={(event) => setMatiere(event.target.value)}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Sous-matière
            <input
              value={subSubject}
              onChange={(event) => setSubSubject(event.target.value)}
              className={inputClassName}
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Compétence visée
            <textarea
              value={competence}
              onChange={(event) => setCompetence(event.target.value)}
              rows={2}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Objectif pédagogique
            <textarea
              value={objectif}
              onChange={(event) => setObjectif(event.target.value)}
              rows={2}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Déroulement
            <textarea
              value={organisation}
              onChange={(event) => setOrganisation(event.target.value)}
              rows={5}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Matériel (séparé par virgules ou retours à la ligne)
            <textarea
              value={materielText}
              onChange={(event) => setMaterielText(event.target.value)}
              rows={2}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Ressources (séparées par virgules ou retours à la ligne)
            <textarea
              value={resourcesText}
              onChange={(event) => setResourcesText(event.target.value)}
              rows={2}
              className={inputClassName}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Observations / notes
            <textarea
              value={observations}
              onChange={(event) => setObservations(event.target.value)}
              rows={3}
              className={inputClassName}
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm font-light text-[#b88989]">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <FloraButton accent="cream" variant="secondary" onClick={onClose} disabled={isSaving}>
            Annuler
          </FloraButton>
          <FloraButton accent="sage" onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? "Enregistrement…" : "Enregistrer le créneau"}
          </FloraButton>
        </div>
      </FloraCard>
    </div>
  );
}
