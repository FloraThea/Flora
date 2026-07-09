"use client";

import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { sequenceExporter } from "@/lib/sequences/SequenceExporter";
import type { SequencePayload } from "@/lib/sequences/types";

type SequenceDetailModalProps = {
  payload: SequencePayload;
  onClose: () => void;
};

export function SequenceDetailModal({ payload, onClose }: SequenceDetailModalProps) {
  const { sequence } = payload;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-flora-text/25 p-4 backdrop-blur-sm">
      <FloraCard padding="lg" className="max-h-[92vh] w-full max-w-5xl overflow-y-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-serif text-3xl text-flora-text">{sequence.title}</h3>
            <p className="mt-2 text-sm font-light text-flora-text-muted">
              {sequence.matiere} · {sequence.sousMatiere} · {sequence.niveau} · {sequence.cycle}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FloraBadge accent="sage">Période {sequence.periodNumber}</FloraBadge>
              <FloraBadge accent="lavender">
                Semaines {sequence.weekNumbers.join(", ")}
              </FloraBadge>
              <FloraBadge accent="peach">{sequence.sessionCount} séances</FloraBadge>
              <FloraBadge accent="cream">{sequence.dureeEstimeeMinutes} min</FloraBadge>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-1 text-sm font-light text-flora-text-muted hover:bg-white/60"
          >
            Fermer
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h4 className="mb-2 font-serif text-lg text-flora-text">Compétence BO</h4>
            <p className="text-sm font-light text-flora-text-muted">{sequence.competenceBo}</p>
            <h4 className="mb-2 mt-4 font-serif text-lg text-flora-text">Attendus</h4>
            <ul className="list-disc pl-5 text-sm font-light text-flora-text-muted">
              {sequence.attendus.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4 className="mb-2 mt-4 font-serif text-lg text-flora-text">Objectifs</h4>
            <ul className="list-disc pl-5 text-sm font-light text-flora-text-muted">
              {sequence.objectifs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section>
            <h4 className="mb-2 font-serif text-lg text-flora-text">Méthode et ressources</h4>
            <p className="text-sm font-light text-flora-text-muted">{sequence.methode || "—"}</p>
            <h4 className="mb-2 mt-4 font-serif text-lg text-flora-text">Ressources</h4>
            <ul className="list-disc pl-5 text-sm font-light text-flora-text-muted">
              {sequence.resources.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <h4 className="mb-2 mt-4 font-serif text-lg text-flora-text">Matériel</h4>
            <ul className="list-disc pl-5 text-sm font-light text-flora-text-muted">
              {sequence.materiel.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>

        <section className="mt-8">
          <h4 className="mb-3 font-serif text-xl text-flora-text">Séances</h4>
          <div className="grid gap-3">
            {payload.sessions.map((session) => (
              <div key={session.id ?? session.sessionNumber} className="rounded-2xl border border-white/70 bg-white/55 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <FloraBadge accent="lavender">Séance {session.sessionNumber}</FloraBadge>
                  <span className="font-serif text-lg text-flora-text">{session.title}</span>
                  <span className="text-sm font-light text-flora-text-subtle">{session.dureeMinutes} min</span>
                </div>
                <p className="mt-2 text-sm font-light text-flora-text-muted">{session.objectif}</p>
                <p className="mt-1 text-xs font-light text-flora-text-subtle">{session.placeProgression}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="mb-3 font-serif text-xl text-flora-text">Évaluations</h4>
            {payload.evaluations.map((evaluation) => (
              <div key={evaluation.id ?? evaluation.label} className="mb-3 rounded-2xl bg-white/50 p-4">
                <p className="font-medium text-flora-text">{evaluation.label}</p>
                <ul className="mt-2 list-disc pl-5 text-sm font-light text-flora-text-muted">
                  {evaluation.criteres.map((critere) => (
                    <li key={critere}>{critere}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div>
            <h4 className="mb-3 font-serif text-xl text-flora-text">Différenciation</h4>
            <p className="text-sm font-medium text-flora-text">Élèves en difficulté</p>
            <ul className="mb-3 list-disc pl-5 text-sm font-light text-flora-text-muted">
              {sequence.differentiation.elevesEnDifficulte.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-sm font-medium text-flora-text">Élèves avancés</p>
            <ul className="mb-3 list-disc pl-5 text-sm font-light text-flora-text-muted">
              {sequence.differentiation.elevesAvances.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-sm font-medium text-flora-text">Adaptations</p>
            <ul className="list-disc pl-5 text-sm font-light text-flora-text-muted">
              {sequence.differentiation.adaptations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <FloraButton onClick={() => sequenceExporter.exportPayload(payload, "word")}>
            Exporter Word
          </FloraButton>
          <FloraButton variant="secondary" onClick={() => sequenceExporter.exportPayload(payload, "pdf")}>
            Exporter PDF
          </FloraButton>
        </div>
      </FloraCard>
    </div>
  );
}
