"use client";

import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { METHODE_OPTIONS, type ProgressionFormValues, type ValidatedProgrammationOption } from "../types";

type ProgressionFormProps = {
  values: ProgressionFormValues;
  programmations: ValidatedProgrammationOption[];
  isLoadingProgrammations: boolean;
  onChange: <K extends keyof ProgressionFormValues>(
    key: K,
    value: ProgressionFormValues[K],
  ) => void;
  onGenerate: () => void;
  onImport: () => void;
  isGenerating: boolean;
};

export function ProgressionForm({
  values,
  programmations,
  isLoadingProgrammations,
  onChange,
  onGenerate,
  onImport,
  isGenerating,
}: ProgressionFormProps) {
  const selected = programmations.find((item) => item.id === values.programmationId);

  return (
    <FloraCard padding="lg" accent="rose">
      <div className="grid gap-6 lg:grid-cols-2">
        <label className="block lg:col-span-2">
          <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
            Programmation validée
          </span>
          <select
            value={values.programmationId}
            onChange={(event) => onChange("programmationId", event.target.value)}
            disabled={isLoadingProgrammations || programmations.length === 0}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          >
            <option value="">
              {programmations.length === 0
                ? "Aucune programmation validée disponible"
                : "Choisir une programmation"}
            </option>
            {programmations.map((programmation) => (
              <option key={programmation.id} value={programmation.id}>
                {programmation.title} — {programmation.school_year} ({programmation.matiere})
              </option>
            ))}
          </select>
        </label>

        {selected && (
          <div className="lg:col-span-2 rounded-2xl border border-white/70 bg-white/50 px-4 py-3 text-sm font-light text-flora-text-muted">
            {selected.levels.join(", ")} · {selected.methode || "Sans méthode"} ·{" "}
            {selected.matiere}
          </div>
        )}

        <label className="block lg:col-span-2">
          <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
            Méthode pédagogique
          </span>
          <select
            value={values.methode}
            onChange={(event) => onChange("methode", event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          >
            {METHODE_OPTIONS.map((methode) => (
              <option key={methode || "inherit"} value={methode}>
                {methode || "Hériter de la programmation"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <FloraButton
          onClick={onGenerate}
          disabled={isGenerating || !values.programmationId}
        >
          {isGenerating ? "Génération en cours…" : "Générer ma progression"}
        </FloraButton>
        <FloraButton
          variant="secondary"
          onClick={onImport}
          disabled={isGenerating || programmations.length === 0}
        >
          Importer une progression
        </FloraButton>
      </div>
    </FloraCard>
  );
}
