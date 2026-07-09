"use client";

import type { PlannerFilters, PlannerViewMode } from "@/lib/annual-planner/types";
import { SUBJECT_FILTER_OPTIONS } from "@/lib/annual-planner/badge-colors";

type PlannerFiltersProps = {
  filters: PlannerFilters;
  onChange: (patch: Partial<PlannerFilters>) => void;
  periods: Array<{ number: number; label: string }>;
  months: string[];
};

const VIEW_OPTIONS: Array<{ id: PlannerViewMode; label: string }> = [
  { id: "annual", label: "Annuel" },
  { id: "period", label: "Période" },
  { id: "month", label: "Mois" },
  { id: "project", label: "Projets" },
  { id: "subject", label: "Matière" },
  { id: "competencies", label: "Compétences" },
  { id: "hours", label: "Horaires" },
];

export function PlannerFiltersPanel({ filters, onChange, periods, months }: PlannerFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-flora-text-muted">Vue</p>
        <div className="flex flex-wrap gap-2">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ view: option.id })}
              className={`rounded-full px-3 py-1.5 text-xs ${
                filters.view === option.id
                  ? "bg-sauge-light/50 text-flora-text"
                  : "bg-white/50 text-flora-text-muted hover:bg-white/70"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filters.view === "period" ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-flora-text-muted">Période</p>
          <div className="flex flex-wrap gap-2">
            {periods.map((period) => (
              <button
                key={period.number}
                type="button"
                onClick={() => onChange({ periodNumber: period.number })}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  filters.periodNumber === period.number
                    ? "bg-lavande-light/50 text-flora-text"
                    : "bg-white/50 text-flora-text-muted"
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {filters.view === "month" ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-flora-text-muted">Mois</p>
          <div className="flex flex-wrap gap-2">
            {months.map((month) => (
              <button
                key={month}
                type="button"
                onClick={() => onChange({ month })}
                className={`rounded-full px-3 py-1.5 text-xs capitalize ${
                  filters.month === month
                    ? "bg-rose-soft/40 text-flora-text"
                    : "bg-white/50 text-flora-text-muted"
                }`}
              >
                {month}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {filters.view === "subject" ? (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-flora-text-muted">Matière</p>
          <div className="flex flex-wrap gap-2">
            {SUBJECT_FILTER_OPTIONS.map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() => onChange({ subject })}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  filters.subject === subject
                    ? "bg-sauge-light/50 text-flora-text"
                    : "bg-white/50 text-flora-text-muted"
                }`}
              >
                {subject}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
