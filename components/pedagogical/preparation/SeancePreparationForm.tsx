"use client";

import { useMemo, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { emptyDeroulementSteps } from "@/lib/pedagogical/preparation/deroulement-utils";
import type { DeroulementStep, SeancePreparationFormValues } from "@/lib/pedagogical/preparation/types";
import type { SeancePayload } from "@/lib/seances/types";
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

const SEANCE_TABS = [
  { id: "matiere", label: "Matière" },
  { id: "sous-matiere", label: "Sous-matière" },
  { id: "competence", label: "Compétence" },
  { id: "objectif", label: "Objectif" },
  { id: "deroulement", label: "Déroulement" },
  { id: "materiel", label: "Matériel" },
  { id: "ressources", label: "Ressources" },
] as const;

const MATIERE_SUGGESTIONS = [
  "Français",
  "Mathématiques",
  "Questionner le monde",
  "EMC",
  "EPS",
  "Arts plastiques",
  "Enseignement moral et civique",
];

type SeancePreparationFormProps = {
  initialValues?: Partial<SeancePreparationFormValues>;
  submitLabel?: string;
  onSubmit: (values: SeancePreparationFormValues) => Promise<void>;
  onCancel: () => void;
};

export function createEmptySeanceFormValues(): SeancePreparationFormValues {
  return {
    title: "",
    matiere: "",
    sousMatiere: "",
    niveau: "",
    cycle: "",
    sessionDate: "",
    dureeMinutes: 45,
    competences: [],
    referentielIds: [],
    objectif: "",
    deroulement: emptyDeroulementSteps(),
    materiel: [],
    resources: [],
    resourceIds: [],
  };
}

export function SeancePreparationForm({
  initialValues,
  submitLabel = "Créer la séance",
  onSubmit,
  onCancel,
}: SeancePreparationFormProps) {
  const [activeTab, setActiveTab] = useState<string>("matiere");
  const [values, setValues] = useState<SeancePreparationFormValues>({
    ...createEmptySeanceFormValues(),
    ...initialValues,
    deroulement: initialValues?.deroulement ?? emptyDeroulementSteps(),
  });
  const [competenceSearch, setCompetenceSearch] = useState("");
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

  function patch(partial: Partial<SeancePreparationFormValues>) {
    setValues((current) => ({ ...current, ...partial }));
  }

  function patchDeroulementStep(index: number, content: string) {
    setValues((current) => ({
      ...current,
      deroulement: current.deroulement.map((step, stepIndex) =>
        stepIndex === index ? { ...step, content } : step,
      ),
    }));
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
      <h3 className="font-serif text-xl font-medium">Préparer une séance</h3>
      <p className="mt-1 text-sm font-light text-flora-text-muted">
        Complétez les onglets pour construire une séance directement exploitable en classe.
      </p>

      <div className="mt-6">
        <PreparationTabBar tabs={[...SEANCE_TABS]} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="mt-6 grid gap-4">
        {activeTab === "matiere" ? (
          <>
            <label className="block md:col-span-2">
              <PreparationFieldLabel>Titre de la séance</PreparationFieldLabel>
              <PreparationTextInput
                value={values.title}
                onChange={(event) => patch({ title: event.target.value })}
                placeholder="Séance — Les fractions"
              />
            </label>
            <label className="block">
              <PreparationFieldLabel>Matière</PreparationFieldLabel>
              <PreparationSelect
                value={values.matiere}
                onChange={(event) =>
                  patch({ matiere: event.target.value, sousMatiere: "", competences: [], referentielIds: [] })
                }
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
              <PreparationFieldLabel>Date</PreparationFieldLabel>
              <PreparationTextInput
                type="date"
                value={values.sessionDate}
                onChange={(event) => patch({ sessionDate: event.target.value })}
              />
            </label>
            <label className="block">
              <PreparationFieldLabel>Durée (minutes)</PreparationFieldLabel>
              <PreparationTextInput
                type="number"
                min={15}
                max={180}
                value={values.dureeMinutes}
                onChange={(event) => patch({ dureeMinutes: Number(event.target.value) })}
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
                placeholder="Rechercher dans le BO…"
              />
            </label>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-white/60 bg-white/40 p-3">
              {referentielLoading ? (
                <p className="text-sm text-flora-text-muted">Chargement…</p>
              ) : filteredCompetences.length === 0 ? (
                <p className="text-sm text-flora-text-muted">
                  Aucune compétence trouvée pour cette matière et ce niveau.
                </p>
              ) : (
                filteredCompetences.map((item) => {
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
                          {[item.domaine, item.niveau, item.code].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            {values.competences.length > 0 ? (
              <p className="text-xs text-flora-text-muted">
                {values.competences.length} compétence(s) sélectionnée(s).
              </p>
            ) : null}
          </>
        ) : null}

        {activeTab === "objectif" ? (
          <label className="block">
            <PreparationFieldLabel>Objectif pédagogique</PreparationFieldLabel>
            <PreparationTextArea
              rows={5}
              value={values.objectif}
              onChange={(event) => patch({ objectif: event.target.value })}
              placeholder="À la fin de la séance, l'élève sera capable de…"
            />
          </label>
        ) : null}

        {activeTab === "deroulement" ? (
          <div className="space-y-4">
            {values.deroulement.map((step, index) => (
              <label key={step.key} className="block">
                <PreparationFieldLabel>{step.label}</PreparationFieldLabel>
                <PreparationTextArea
                  rows={3}
                  value={step.content}
                  onChange={(event) => patchDeroulementStep(index, event.target.value)}
                  placeholder={`Décrire l'étape « ${step.label} »…`}
                />
              </label>
            ))}
          </div>
        ) : null}

        {activeTab === "materiel" ? (
          <label className="block">
            <PreparationFieldLabel>Matériel nécessaire (un élément par ligne)</PreparationFieldLabel>
            <PreparationTextArea
              rows={6}
              value={listToLines(values.materiel)}
              onChange={(event) => patch({ materiel: linesToList(event.target.value) })}
              placeholder={"Cahier\nAffichage\nJetons de numération"}
            />
          </label>
        ) : null}

        {activeTab === "ressources" ? (
          <>
            <label className="block">
              <PreparationFieldLabel>Liens et ressources libres (un par ligne)</PreparationFieldLabel>
              <PreparationTextArea
                rows={4}
                value={listToLines(values.resources)}
                onChange={(event) => patch({ resources: linesToList(event.target.value) })}
                placeholder={"Guide du maître p. 12\nFiche Flora générée"}
              />
            </label>
            <div>
              <PreparationFieldLabel>Documents de la bibliothèque</PreparationFieldLabel>
              <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-white/60 bg-white/40 p-3">
                {libraryLoading ? (
                  <p className="text-sm text-flora-text-muted">Chargement de la bibliothèque…</p>
                ) : libraryResources.length === 0 ? (
                  <p className="text-sm text-flora-text-muted">Aucun document trouvé pour cette matière.</p>
                ) : (
                  libraryResources.slice(0, 40).map((resource) => {
                    const selected = values.resourceIds.includes(resource.id);
                    return (
                      <label
                        key={resource.id}
                        className={`flex cursor-pointer gap-3 rounded-xl px-3 py-2 text-sm ${
                          selected ? "bg-flora-lavender/20" : "hover:bg-white/50"
                        }`}
                      >
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
                        <span>
                          <span className="block font-medium">{resource.title}</span>
                          <span className="text-xs text-flora-text-muted">
                            {[resource.category, resource.format].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
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

export type { SeancePayload };
