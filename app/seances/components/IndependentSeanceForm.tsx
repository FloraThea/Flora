"use client";

import { useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { SeancePayload } from "@/lib/seances/types";

type IndependentSeanceFormProps = {
  onCreated: (payload: SeancePayload) => void;
  onCancel: () => void;
};

export function IndependentSeanceForm({ onCreated, onCancel }: IndependentSeanceFormProps) {
  const [title, setTitle] = useState("");
  const [matiere, setMatiere] = useState("");
  const [niveau, setNiveau] = useState("");
  const [objectif, setObjectif] = useState("");
  const [competenceBo, setCompetenceBo] = useState("");
  const [dureeMinutes, setDureeMinutes] = useState(45);
  const [sessionDate, setSessionDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/seances/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          matiere,
          niveau,
          objectif,
          competenceBo,
          dureeMinutes,
          sessionDate: sessionDate || null,
        }),
      });

      const data = (await response.json()) as SeancePayload & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Impossible de créer la séance.");
      }

      onCreated(data);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Impossible de créer la séance.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <FloraCard padding="lg" accent="rose">
      <h3 className="font-serif text-xl font-medium">Créer une séance indépendante</h3>
      <p className="mt-1 text-sm font-light text-flora-text-muted">
        Aucune séquence requise. Cette séance pourra être ajoutée au cahier journal ou liée plus tard.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
            Titre
          </span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            placeholder="Séance — Les fractions"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
            Matière
          </span>
          <input
            value={matiere}
            onChange={(event) => setMatiere(event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
            Niveau
          </span>
          <input
            value={niveau}
            onChange={(event) => setNiveau(event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
            Date
          </span>
          <input
            type="date"
            value={sessionDate}
            onChange={(event) => setSessionDate(event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
            Durée (minutes)
          </span>
          <input
            type="number"
            min={15}
            max={180}
            value={dureeMinutes}
            onChange={(event) => setDureeMinutes(Number(event.target.value))}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
            Objectif
          </span>
          <textarea
            value={objectif}
            onChange={(event) => setObjectif(event.target.value)}
            rows={3}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
            Compétence
          </span>
          <input
            value={competenceBo}
            onChange={(event) => setCompetenceBo(event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm text-[#b88989]">{error}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <FloraButton
          onClick={() => void handleSubmit()}
          disabled={isSaving || !title.trim() || !matiere.trim()}
        >
          {isSaving ? "Création…" : "Créer la séance"}
        </FloraButton>
        <FloraButton variant="secondary" onClick={onCancel}>
          Annuler
        </FloraButton>
      </div>
    </FloraCard>
  );
}
