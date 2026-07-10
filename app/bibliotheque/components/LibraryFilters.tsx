import { FloraCard } from "@/components/ui/FloraCard";
import { getListKey } from "@/lib/list-keys";
import type { LibraryFilterOptions } from "@/lib/library/types";
import { colors } from "@/lib/theme";
import type { LibraryFilterValues } from "../types";

type LibraryFiltersProps = {
  values: LibraryFilterValues;
  options: LibraryFilterOptions;
  onChange: (key: keyof LibraryFilterValues, value: string) => void;
};

const SORT_OPTIONS = [
  { value: "date", label: "Date d'import" },
  { value: "updated", label: "Dernière utilisation" },
  { value: "name", label: "Nom" },
  { value: "size", label: "Taille" },
];

export function LibraryFilters({ values, options, onChange }: LibraryFiltersProps) {
  const fields: Array<{
    key: keyof LibraryFilterValues;
    label: string;
    choices: string[];
  }> = [
    { key: "category", label: "Catégorie", choices: options.categories },
    { key: "discipline", label: "Discipline", choices: options.disciplines },
    { key: "niveau", label: "Niveau", choices: options.niveaux },
    { key: "methode", label: "Méthode", choices: options.methodes },
    { key: "format", label: "Format", choices: options.formats },
  ];

  return (
    <FloraCard padding="lg" accent="lavender">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fields.map(({ key, label, choices }) => (
          <label key={key}>
            <span
              className="mb-2 block text-[11px] font-medium tracking-[0.12em] uppercase"
              style={{ color: colors.charcoal.label }}
            >
              {label}
            </span>
            <select
              value={values[key]}
              onChange={(event) => onChange(key, event.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
            >
              {choices.map((option, optionIndex) => (
                <option
                  key={getListKey(null, [key, option], optionIndex, "library-filter")}
                  value={option}
                >
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}

        <label>
          <span
            className="mb-2 block text-[11px] font-medium tracking-[0.12em] uppercase"
            style={{ color: colors.charcoal.label }}
          >
            Tri
          </span>
          <select
            value={values.sort}
            onChange={(event) => onChange("sort", event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </FloraCard>
  );
}
