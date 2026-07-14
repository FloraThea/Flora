"use client";

import { useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import type { SequencePayload } from "@/lib/sequences/types";

type IndependentSequenceFormProps = {
  onCreated: (payload: SequencePayload) => void;
  onCancel: () => void;
};

export function IndependentSequenceForm({ onCreated, onCancel }: IndependentSequenceFormProps) {
  const [title, setTitle] = useState("");
  const [matiere, setMatiere] = useState("");
  const [niveau, setNiveau] = useState("");
  const [competenceBo, setCompetenceBo] = useState("");
  const [objectifs, setObjectifs] = useState("");
  const [sessionCount, setSessionCount] = useState(3);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/sequences/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          matiere,
          niveau,
          competenceBo,
          sessionCount,
          objectifs: objectifs
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        }),
      });

      const data = (await response.json()) as SequencePayload & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Impossible de créer la séquence.");
      }

      onCreated(data);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Impossible de créer la séquence.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <FloraCard padding="lg" accent="rose">
      <h3 className="font-serif text-xl font-medium">Créer une séquence indépendante</h3>
      <p className="mt-1 text-sm font-light text-flora-text-muted">
        Aucune progression requise. Vous pourrez associer cette séquence plus tard.
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
            placeholder="Séquence 1 — Identifier le verbe"
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
            placeholder="Français"
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
            placeholder="CE1-CE2"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
            Compétence
          </span>
          <input
            value={competenceBo}
            onChange={(event) => setCompetenceBo(event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
            Nombre de séances
          </span>
          <input
            type="number"
            min={1}
            max={12}
            value={sessionCount}
            onChange={(event) => setSessionCount(Number(event.target.value))}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
            Objectifs (un par ligne)
          </span>
          <textarea
            value={objectifs}
            onChange={(event) => setObjectifs(event.target.value)}
            rows={4}
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
          {isSaving ? "Création…" : "Créer la séquence"}
        </FloraButton>
        <FloraButton variant="secondary" onClick={onCancel}>
          Annuler
        </FloraButton>
      </div>
    </FloraCard>
  );
}
