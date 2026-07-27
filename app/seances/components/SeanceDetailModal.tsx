"use client";

import { useState } from "react";
import { FloraBadge } from "@/components/ui/FloraBadge";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import {
  CompetenceAssociationSummary,
  readCompetenceAssociationMetadata,
} from "@/components/pedagogical/CompetenceAssociationSummary";
import { SeancePreparationForm } from "@/components/pedagogical/preparation/SeancePreparationForm";
import {
  mapSeanceFormToUpdateInput,
  mapSeancePayloadToFormValues,
} from "@/lib/pedagogical/preparation/form-mappers";
import { deroulementSummary, parseDeroulementSteps } from "@/lib/pedagogical/preparation/deroulement-utils";
import { lessonExporter } from "@/lib/seances/LessonExporter";
import type { SeancePayload } from "@/lib/seances/types";

type SeanceDetailModalProps = {
  payload: SeancePayload;
  onClose: () => void;
  onUpdated: (payload: SeancePayload) => void;
};

const inputClassName =
  "w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm font-light outline-none focus:border-rose-poudre/50";

function collectMaterielItems(payload: SeancePayload): string[] {
  const { materiel } = payload.seance;
  return [
    ...materiel.guides,
    ...materiel.albums,
    ...materiel.affichages,
    ...materiel.manipulation,
    ...materiel.videoprojecteur,
    ...materiel.photocopies,
    ...materiel.fiches,
    ...materiel.cartes,
    ...materiel.jeux,
    ...materiel.autres,
  ].filter(Boolean);
}

export function SeanceDetailModal({ payload, onClose, onUpdated }: SeanceDetailModalProps) {
  const [localPayload, setLocalPayload] = useState(payload);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { seance } = localPayload;
  const competenceAssociation = readCompetenceAssociationMetadata(seance.metadata);
  const deroulement = parseDeroulementSteps(seance.metadata?.deroulement);
  const deroulementText =
    deroulementSummary(deroulement) ||
    localPayload.phases
      .filter((phase) => phase.summary.trim())
      .map((phase) => `${phase.title}: ${phase.summary.trim()}`)
      .join("\n\n");
  const competences = Array.isArray(seance.metadata?.competences)
    ? seance.metadata.competences.map(String).filter(Boolean)
    : seance.competenceBo
      ? [seance.competenceBo]
      : [];
  const materielItems = collectMaterielItems(localPayload);

  const patchField = async (
    entityType: "seance" | "phase" | "activity",
    entityId: string,
    field: string,
    value: unknown,
  ) => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/seances/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seanceId: seance.id, entityType, entityId, field, value }),
      });

      const data = (await response.json()) as SeancePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Mise à jour impossible.");

      setLocalPayload(data);
      onUpdated(data);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Erreur de mise à jour.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/seances/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seanceId: seance.id }),
      });

      const data = (await response.json()) as SeancePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Annulation impossible.");

      setLocalPayload(data);
      onUpdated(data);
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : "Erreur d'annulation.");
    } finally {
      setIsSaving(false);
    }
  };

  const duplicateActivity = async (activityId: string) => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/seances/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: { type: "duplicate_activity", seanceId: seance.id, activityId },
        }),
      });

      const data = (await response.json()) as SeancePayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Duplication impossible.");

      setLocalPayload(data);
      onUpdated(data);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "Erreur de duplication.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-flora-text/25 p-4 backdrop-blur-sm">
        <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto">
          <SeancePreparationForm
            initialValues={mapSeancePayloadToFormValues(localPayload)}
            submitLabel="Enregistrer la séance"
            onCancel={() => setIsEditing(false)}
            onSubmit={async (values) => {
              const body = mapSeanceFormToUpdateInput(seance.id, values);
              const response = await fetch("/api/seances/update", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
              const data = (await response.json()) as SeancePayload & { error?: string };
              if (!response.ok) {
                throw new Error(data.error || "Impossible de mettre à jour la séance.");
              }
              setLocalPayload(data);
              onUpdated(data);
              setIsEditing(false);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-flora-text/25 p-4 backdrop-blur-sm">
      <FloraCard padding="lg" className="max-h-[92vh] w-full max-w-6xl overflow-y-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex-1">
            <input
              className={`${inputClassName} font-serif text-3xl`}
              value={seance.title}
              onChange={(event) =>
                setLocalPayload({
                  ...localPayload,
                  seance: { ...seance, title: event.target.value },
                })
              }
              onBlur={(event) => void patchField("seance", seance.id, "title", event.target.value)}
            />
            <p className="mt-2 text-sm font-light text-flora-text-muted">
              {seance.matiere}
              {seance.sousMatiere ? ` · ${seance.sousMatiere}` : ""} · {seance.niveau} · {seance.cycle}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <FloraBadge accent="sage">Période {seance.periodNumber}</FloraBadge>
              <FloraBadge accent="lavender">Semaine {seance.weekNumber}</FloraBadge>
              <FloraBadge accent="peach">{seance.dureeMinutes} min</FloraBadge>
              <FloraBadge accent="cream">{seance.methode || "Méthode"}</FloraBadge>
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

        {error ? <p className="mb-4 text-sm text-[#b88989]">{error}</p> : null}

        <div className="mb-6 flex flex-wrap gap-2">
          <FloraButton variant="secondary" onClick={() => setIsEditing(true)}>
            Modifier la séance
          </FloraButton>
          <FloraButton variant="secondary" onClick={() => void handleUndo()} disabled={isSaving}>
            Annuler la dernière modification
          </FloraButton>
          <FloraButton onClick={() => lessonExporter.exportPayload(localPayload, "word")}>
            Word
          </FloraButton>
          <FloraButton variant="secondary" onClick={() => lessonExporter.exportPayload(localPayload, "pdf")}>
            PDF
          </FloraButton>
          <FloraButton variant="secondary" onClick={() => lessonExporter.exportPayload(localPayload, "ppt")}>
            PowerPoint
          </FloraButton>
          <FloraButton variant="secondary" onClick={() => lessonExporter.exportPayload(localPayload, "print")}>
            Imprimer
          </FloraButton>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h4 className="mb-2 font-serif text-lg text-flora-text">Compétence(s)</h4>
            {competences.length > 0 ? (
              <ul className="list-disc pl-5 text-sm font-light text-flora-text-muted">
                {competences.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-light text-flora-text-muted">—</p>
            )}
            <CompetenceAssociationSummary association={competenceAssociation} className="mt-4" />

            <h4 className="mb-2 mt-4 font-serif text-lg text-flora-text">Objectif</h4>
            <textarea
              rows={3}
              className={inputClassName}
              value={seance.objectif}
              onChange={(event) =>
                setLocalPayload({
                  ...localPayload,
                  seance: { ...seance, objectif: event.target.value },
                })
              }
              onBlur={(event) => void patchField("seance", seance.id, "objectif", event.target.value)}
            />

            {deroulementText ? (
              <>
                <h4 className="mb-2 mt-4 font-serif text-lg text-flora-text">Déroulement</h4>
                <p className="whitespace-pre-wrap text-sm font-light text-flora-text-muted">
                  {deroulementText}
                </p>
              </>
            ) : null}
          </section>

          <section>
            <h4 className="mb-2 font-serif text-lg text-flora-text">Matériel</h4>
            {materielItems.length > 0 ? (
              <ul className="list-disc pl-5 text-sm font-light text-flora-text-muted">
                {materielItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-light text-flora-text-muted">—</p>
            )}

            <h4 className="mb-2 mt-4 font-serif text-lg text-flora-text">Ressources</h4>
            {seance.resources.length > 0 ? (
              <ul className="list-disc pl-5 text-sm font-light text-flora-text-muted">
                {seance.resources.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-light text-flora-text-muted">—</p>
            )}

            <h4 className="mb-2 mt-4 font-serif text-lg text-flora-text">Trace écrite élève</h4>
            <textarea
              rows={5}
              className={inputClassName}
              value={seance.traceEcrite.eleve}
              onChange={(event) =>
                setLocalPayload({
                  ...localPayload,
                  seance: {
                    ...seance,
                    traceEcrite: { ...seance.traceEcrite, eleve: event.target.value },
                  },
                })
              }
              onBlur={(event) =>
                void patchField("seance", seance.id, "traceEcrite", {
                  ...seance.traceEcrite,
                  eleve: event.target.value,
                })
              }
            />
            <h4 className="mb-2 mt-4 font-serif text-lg text-flora-text">Évaluation formative</h4>
            <p className="text-sm font-light text-flora-text-muted">{seance.evaluation.formative || "—"}</p>

            {seance.pedagogicalChoices.length > 0 ? (
              <>
                <h4 className="mb-2 mt-4 font-serif text-lg text-flora-text">Choix pédagogiques</h4>
                <ul className="list-disc pl-5 text-sm font-light text-flora-text-muted">
                  {seance.pedagogicalChoices.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        </div>

        <section className="mt-8">
          <h4 className="mb-4 font-serif text-xl text-flora-text">Déroulé détaillé</h4>
          <div className="grid gap-4">
            {localPayload.phases.map((phase) => (
              <div
                key={phase.id}
                className="rounded-2xl border border-white/70 bg-white/45 p-4"
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <FloraBadge accent="lavender">{phase.title}</FloraBadge>
                  <FloraBadge accent="cream">{phase.dureeMinutes} min</FloraBadge>
                </div>
                <textarea
                  rows={2}
                  className={`${inputClassName} mb-4`}
                  value={phase.summary}
                  onChange={(event) =>
                    setLocalPayload({
                      ...localPayload,
                      phases: localPayload.phases.map((item) =>
                        item.id === phase.id ? { ...item, summary: event.target.value } : item,
                      ),
                    })
                  }
                  onBlur={(event) =>
                    phase.id &&
                    void patchField("phase", phase.id, "summary", event.target.value)
                  }
                />
                {phase.activities.map((activity) => (
                  <div key={activity.id} className="mb-3 rounded-xl border border-white/60 bg-white/50 p-3">
                    <textarea
                      rows={2}
                      className={`${inputClassName} mb-2`}
                      value={activity.consignesEnseignant}
                      onChange={(event) =>
                        setLocalPayload({
                          ...localPayload,
                          phases: localPayload.phases.map((item) =>
                            item.id === phase.id
                              ? {
                                  ...item,
                                  activities: item.activities.map((entry) =>
                                    entry.id === activity.id
                                      ? { ...entry, consignesEnseignant: event.target.value }
                                      : entry,
                                  ),
                                }
                              : item,
                          ),
                        })
                      }
                      onBlur={(event) =>
                        activity.id &&
                        void patchField(
                          "activity",
                          activity.id,
                          "consignesEnseignant",
                          event.target.value,
                        )
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      {activity.id ? (
                        <button
                          type="button"
                          className="text-xs text-[#b88989] hover:underline"
                          onClick={() => void duplicateActivity(activity.id!)}
                        >
                          Dupliquer
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      </FloraCard>
    </div>
  );
}
