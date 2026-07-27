"use client";

import { useMemo, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { emptyDeroulementSteps } from "@/lib/pedagogical/preparation/deroulement-utils";
import type {
  DeroulementStep,
  SequencePreparationFormValues,
  SequenceSessionFormValues,
} from "@/lib/pedagogical/preparation/types";
import type { SequencePayload } from "@/lib/sequences/types";
import {
  PreparationFieldLabel,
  PreparationSelect,
  PreparationTabBar,
  PreparationTextArea,
  PreparationTextInput,
  linesToList,
  listToLines,
} from "./PreparationTabBar";
import { toggleIdValue, useLibraryResources, useReferentielOptions } from "./use-preparation-options";

const SEQUENCE_TABS = [
  { id: "matiere", label: "Matière" },
  { id: "sous-matiere", label: "Sous-matière" },
  { id: "competence", label: "Compétence" },
  { id: "objectif", label: "Objectif général" },
  { id: "deroulement", label: "Déroulement général" },
  { id: "materiel", label: "Matériel" },
  { id: "ressources", label: "Ressources" },
  { id: "seances", label: "Séances de la séquence" },
] as const;

const MATIERE_SUGGESTIONS = [
  "Français",
  "Mathématiques",
  "Questionner le monde",
  "EMC",
  "EPS",
  "Arts plastiques",
];

function createEmptySession(sessionNumber: number, matiere: string): SequenceSessionFormValues {
  return {
    sessionNumber,
    title: `Séance ${sessionNumber} — ${matiere}`,
    objectif: "",
    dureeMinutes: 45,
    competences: [],
    referentielIds: [],
    deroulement: emptyDeroulementSteps(),
    materiel: [],
    resources: [],
    resourceIds: [],
  };
}

export function createEmptySequenceFormValues(sessionCount = 3): SequencePreparationFormValues {
  return {
    title: "",
    matiere: "",
    sousMatiere: "",
    niveau: "",
    cycle: "",
    competences: [],
    referentielIds: [],
    objectifGeneral: "",
    deroulementGeneral: emptyDeroulementSteps(),
    materiel: [],
    resources: [],
    resourceIds: [],
    sessions: Array.from({ length: sessionCount }, (_, index) =>
      createEmptySession(index + 1, ""),
    ),
  };
}

type SequencePreparationFormProps = {
  initialValues?: Partial<SequencePreparationFormValues>;
  submitLabel?: string;
  onSubmit: (values: SequencePreparationFormValues) => Promise<void>;
  onCancel: () => void;
};

export function SequencePreparationForm({
  initialValues,
  submitLabel = "Créer la séquence",
  onSubmit,
  onCancel,
}: SequencePreparationFormProps) {
  const [activeTab, setActiveTab] = useState<string>("matiere");
  const [values, setValues] = useState<SequencePreparationFormValues>({
    ...createEmptySequenceFormValues(initialValues?.sessions?.length ?? 3),
    ...initialValues,
    deroulementGeneral: initialValues?.deroulementGeneral ?? emptyDeroulementSteps(),
    sessions: initialValues?.sessions?.length
      ? initialValues.sessions
      : createEmptySequenceFormValues(3).sessions,
  });
  const [competenceSearch, setCompetenceSearch] = useState("");
  const [activeSessionIndex, setActiveSessionIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { domaines, competences, loading: referentielLoading } = useReferentielOptions({
    matiere: values.matiere,
    niveau: values.niveau,
    sousMatiere: values.sousMatiere,
  });
  const { resources: libraryResources, loading: libraryLoading } = useLibraryResources(values.matiere);

  const filteredCompetences = useMemo(() => {
    const query = competenceSearch.trim().toLowerCase();
    if (!query) return competences;
    return competences.filter(
      (item) =>
        item.competence.toLowerCase().includes(query) ||
        String(item.code ?? "").toLowerCase().includes(query),
    );
  }, [competences, competenceSearch]);

  const activeSession = values.sessions[activeSessionIndex];

  function patch(partial: Partial<SequencePreparationFormValues>) {
    setValues((current) => ({ ...current, ...partial }));
  }

  function patchDeroulement(steps: DeroulementStep[]) {
    patch({ deroulementGeneral: steps });
  }

  function patchGeneralDeroulementStep(index: number, content: string) {
    patchDeroulement(
      values.deroulementGeneral.map((step, stepIndex) =>
        stepIndex === index ? { ...step, content } : step,
      ),
    );
  }

  function patchSession(index: number, partial: Partial<SequenceSessionFormValues>) {
    setValues((current) => ({
      ...current,
      sessions: current.sessions.map((session, sessionIndex) =>
        sessionIndex === index ? { ...session, ...partial } : session,
      ),
    }));
  }

  function patchSessionDeroulementStep(sessionIndex: number, stepIndex: number, content: string) {
    const session = values.sessions[sessionIndex];
    if (!session) return;
    patchSession(sessionIndex, {
      deroulement: session.deroulement.map((step, index) =>
        index === stepIndex ? { ...step, content } : step,
      ),
    });
  }

  function setSessionCount(count: number) {
    const safeCount = Math.max(1, Math.min(12, count));
    setValues((current) => {
      const sessions = [...current.sessions];
      while (sessions.length < safeCount) {
        sessions.push(createEmptySession(sessions.length + 1, current.matiere));
      }
      while (sessions.length > safeCount) sessions.pop();
      return {
        ...current,
        sessions: sessions.map((session, index) => ({
          ...session,
          sessionNumber: index + 1,
        })),
      };
    });
    if (activeSessionIndex >= safeCount) setActiveSessionIndex(Math.max(0, safeCount - 1));
  }

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Enregistrement impossible.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <FloraCard padding="lg" accent="rose">
      <h3 className="font-serif text-xl font-medium">Préparer une séquence</h3>
      <p className="mt-1 text-sm font-light text-flora-text-muted">
        Structurez la séquence et détaillez chaque séance avant la mise en classe.
      </p>

      <div className="mt-6">
        <PreparationTabBar tabs={[...SEQUENCE_TABS]} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="mt-6 grid gap-4">
        {activeTab === "matiere" ? (
          <>
            <label className="block">
              <PreparationFieldLabel>Titre de la séquence</PreparationFieldLabel>
              <PreparationTextInput
                value={values.title}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="Séquence 1 — Identifier le verbe"
              />
            </label>
            <label className="block">
              <PreparationFieldLabel>Matière</PreparationFieldLabel>
              <PreparationSelect
                value={values.matiere}
                onChange={(event) => {
                  const matiere = event.target.value;
                  patch({
                    matiere,
                    sousMatiere: "",
                    competences: [],
                    referentielIds: [],
                    sessions: values.sessions.map((session) => ({
                      ...session,
                      title: session.title.includes("—")
                        ? session.title.replace(/^Séance \d+ — .+$/, `Séance ${session.sessionNumber} — ${matiere}`)
                        : `Séance ${session.sessionNumber} — ${matiere}`,
                    })),
                  });
                }}
              >
                <option value="">Choisir…</option>
                {MATIERE_SUGGESTIONS.map((matiere) => (
                  <option key={matiere} value={matiere}>
                    {matiere}
                  </option>
                ))}
              </PreparationSelect>
            </label>
            <label className="block">
              <PreparationFieldLabel>Niveau</PreparationFieldLabel>
              <PreparationSelect
                value={values.niveau}
                onChange={(event) => patch({ niveau: event.target.value })}
              >
                <option value="">Non précisé</option>
                {["CP", "CE1", "CE2", "CM1", "CM2"].map((niveau) => (
                  <option key={niveau} value={niveau}>
                    {niveau}
                  </option>
                ))}
              </PreparationSelect>
            </label>
            <label className="block">
              <PreparationFieldLabel>Nombre de séances</PreparationFieldLabel>
              <PreparationTextInput
                type="number"
                min={1}
                max={12}
                value={values.sessions.length}
                onChange={(event) => setSessionCount(Number(event.target.value))}
              />
            </label>
          </>
        ) : null}

        {activeTab === "sous-matiere" ? (
          <label className="block">
            <PreparationFieldLabel>Sous-matière (référentiel BO)</PreparationFieldLabel>
            {referentielLoading ? (
              <p className="text-sm text-flora-text-muted">Chargement du référentiel…</p>
            ) : domaines.length === 0 ? (
              <p className="text-sm text-flora-text-muted">
                Sélectionnez d&apos;abord une matière pour afficher les sous-matières du BO.
              </p>
            ) : (
              <PreparationSelect
                value={values.sousMatiere}
                onChange={(event) =>
                  patch({ sousMatiere: event.target.value, competences: [], referentielIds: [] })
                }
              >
                <option value="">Choisir…</option>
                {domaines.map((domaine) => (
                  <option key={domaine} value={domaine}>
                    {domaine}
                  </option>
                ))}
              </PreparationSelect>
            )}
          </label>
        ) : null}

        {activeTab === "competence" ? (
          <>
            <label className="block">
              <PreparationFieldLabel>Rechercher une compétence</PreparationFieldLabel>
              <PreparationTextInput
                value={competenceSearch}
                onChange={(event) => setCompetenceSearch(event.target.value)}
              />
            </label>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-white/60 bg-white/40 p-3">
              {filteredCompetences.map((item) => {
                const selected = values.referentielIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex cursor-pointer gap-3 rounded-xl px-3 py-2 text-sm ${
                      selected ? "bg-flora-sage/20" : "hover:bg-white/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        const referentielIds = toggleIdValue(values.referentielIds, item.id);
                        const competencesSelected = selected
                          ? values.competences.filter((value) => value !== item.competence)
                          : [...values.competences, item.competence];
                        patch({ referentielIds, competences: competencesSelected });
                      }}
                    />
                    <span>
                      <span className="block font-medium">{item.competence}</span>
                      <span className="text-xs text-flora-text-muted">
                        {[item.domaine, item.niveau].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </>
        ) : null}

        {activeTab === "objectif" ? (
          <label className="block">
            <PreparationFieldLabel>Objectif général de la séquence</PreparationFieldLabel>
            <PreparationTextArea
              rows={5}
              value={values.objectifGeneral}
              onChange={(event) => patch({ objectifGeneral: event.target.value })}
            />
          </label>
        ) : null}

        {activeTab === "deroulement" ? (
          <div className="space-y-4">
            {values.deroulementGeneral.map((step, index) => (
              <label key={step.key} className="block">
                <PreparationFieldLabel>{step.label}</PreparationFieldLabel>
                <PreparationTextArea
                  rows={3}
                  value={step.content}
                  onChange={(event) => patchGeneralDeroulementStep(index, event.target.value)}
                />
              </label>
            ))}
          </div>
        ) : null}

        {activeTab === "materiel" ? (
          <label className="block">
            <PreparationFieldLabel>Matériel commun (un élément par ligne)</PreparationFieldLabel>
            <PreparationTextArea
              rows={6}
              value={listToLines(values.materiel)}
              onChange={(event) => patch({ materiel: linesToList(event.target.value) })}
            />
          </label>
        ) : null}

        {activeTab === "ressources" ? (
          <>
            <label className="block">
              <PreparationFieldLabel>Ressources libres (un par ligne)</PreparationFieldLabel>
              <PreparationTextArea
                rows={4}
                value={listToLines(values.resources)}
                onChange={(event) => patch({ resources: linesToList(event.target.value) })}
              />
            </label>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/60 bg-white/40 p-3">
              {libraryLoading ? (
                <p className="text-sm text-flora-text-muted">Chargement…</p>
              ) : (
                libraryResources.slice(0, 40).map((resource) => {
                  const selected = values.resourceIds.includes(resource.id);
                  return (
                    <label key={resource.id} className="flex cursor-pointer gap-3 rounded-xl px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          const resourceIds = toggleIdValue(values.resourceIds, resource.id);
                          const resources = selected
                            ? values.resources.filter((value) => value !== resource.title)
                            : [...values.resources, resource.title];
                          patch({ resourceIds, resources });
                        }}
                      />
                      <span>{resource.title}</span>
                    </label>
                  );
                })
              )}
            </div>
          </>
        ) : null}

        {activeTab === "seances" && activeSession ? (
          <>
            <div className="flex flex-wrap gap-2">
              {values.sessions.map((session, index) => (
                <button
                  key={session.sessionNumber}
                  type="button"
                  onClick={() => setActiveSessionIndex(index)}
                  className={`rounded-full px-3 py-1 text-xs ${
                    activeSessionIndex === index
                      ? "bg-flora-lavender/30 font-medium"
                      : "bg-white/50 text-flora-text-muted"
                  }`}
                >
                  Séance {session.sessionNumber}
                </button>
              ))}
            </div>

            <label className="block">
              <PreparationFieldLabel>Titre de la séance</PreparationFieldLabel>
              <PreparationTextInput
                value={activeSession.title}
                onChange={(event) => patchSession(activeSessionIndex, { title: event.target.value })}
              />
            </label>

            <label className="block">
              <PreparationFieldLabel>Objectif spécifique</PreparationFieldLabel>
              <PreparationTextArea
                rows={3}
                value={activeSession.objectif}
                onChange={(event) => patchSession(activeSessionIndex, { objectif: event.target.value })}
              />
            </label>

            <label className="block">
              <PreparationFieldLabel>Compétence(s) mobilisée(s)</PreparationFieldLabel>
              <PreparationTextArea
                rows={2}
                value={activeSession.competences.join("\n")}
                onChange={(event) =>
                  patchSession(activeSessionIndex, { competences: linesToList(event.target.value) })
                }
                placeholder={"Une compétence par ligne"}
              />
            </label>

            <div className="space-y-3">
              <PreparationFieldLabel>Déroulement succinct</PreparationFieldLabel>
              {activeSession.deroulement.map((step, stepIndex) => (
                <label key={step.key} className="block">
                  <span className="mb-1 block text-xs text-flora-text-muted">{step.label}</span>
                  <PreparationTextArea
                    rows={2}
                    value={step.content}
                    onChange={(event) =>
                      patchSessionDeroulementStep(activeSessionIndex, stepIndex, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>

            <label className="block">
              <PreparationFieldLabel>Matériel</PreparationFieldLabel>
              <PreparationTextArea
                rows={3}
                value={listToLines(activeSession.materiel)}
                onChange={(event) =>
                  patchSession(activeSessionIndex, { materiel: linesToList(event.target.value) })
                }
              />
            </label>

            <label className="block">
              <PreparationFieldLabel>Ressources</PreparationFieldLabel>
              <PreparationTextArea
                rows={3}
                value={listToLines(activeSession.resources)}
                onChange={(event) =>
                  patchSession(activeSessionIndex, { resources: linesToList(event.target.value) })
                }
              />
            </label>
          </>
        ) : null}
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm text-[#b88989]">{error}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <FloraButton
          onClick={() => void handleSubmit()}
          disabled={isSaving || !values.title.trim() || !values.matiere.trim()}
        >
          {isSaving ? "Enregistrement…" : submitLabel}
        </FloraButton>
        <FloraButton variant="secondary" onClick={onCancel}>
          Annuler
        </FloraButton>
      </div>
    </FloraCard>
  );
}

export type { SequencePayload };
