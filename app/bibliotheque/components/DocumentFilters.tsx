import { FloraCard } from "@/components/ui/FloraCard";
import { getListKey } from "@/lib/list-keys";
import { colors } from "@/lib/theme";
import type { FilterOptions, FilterValues } from "../types";

type DocumentFiltersProps = {
  values: FilterValues;
  options: FilterOptions;
  onChange: (key: keyof FilterValues, value: string) => void;
};

const FILTER_LABELS: Record<keyof FilterValues, string> = {
  type: "Type",
  matiere: "Matière",
  sousMatiere: "Sous-matière",
  niveau: "Niveau",
  cycle: "Cycle",
  methode: "Méthode",
};

export function DocumentFilters({
  values,
  options,
  onChange,
}: DocumentFiltersProps) {
  return (
    <FloraCard padding="lg" accent="lavender">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(FILTER_LABELS) as Array<keyof FilterValues>).map(
          (filterKey) => (
            <label key={filterKey}>
              <span
                className="mb-2 block text-[11px] font-medium tracking-[0.12em] uppercase"
                style={{ color: colors.charcoal.label }}
              >
                {FILTER_LABELS[filterKey]}
              </span>
              <select
                value={values[filterKey]}
                onChange={(event) => onChange(filterKey, event.target.value)}
                className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
              >
                {options[filterKey].map((option, optionIndex) => (
                  <option
                    key={getListKey(null, [filterKey, option], optionIndex, "filter")}
                    value={option}
                  >
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ),
        )}
      </div>
    </FloraCard>
  );
}
