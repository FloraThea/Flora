"use client";

import { FloraCard } from "@/components/ui/FloraCard";
import { FloraButton } from "@/components/ui/FloraButton";
import type { SchoolLevel } from "@/lib/programming/types";
import {
  buildSchoolYearOptions,
  MATIERE_OPTIONS,
  METHODE_OPTIONS,
  type ProgrammationFormValues,
} from "../types";

type ProgrammationFormProps = {
  values: ProgrammationFormValues;
  onChange: <K extends keyof ProgrammationFormValues>(
    key: K,
    value: ProgrammationFormValues[K],
  ) => void;
  onGenerate: () => void;
  onImport?: () => void;
  isGenerating: boolean;
};

const LEVELS: SchoolLevel[] = ["CP", "CE1", "CE2", "CM1", "CM2"];

export function ProgrammationForm({
  values,
  onChange,
  onGenerate,
  onImport,
  isGenerating,
}: ProgrammationFormProps) {
  const toggleLevel = (level: SchoolLevel) => {
    const next = values.levels.includes(level)
      ? values.levels.filter((item) => item !== level)
      : [...values.levels, level];
    onChange("levels", next);
  };

  return (
    <FloraCard padding="lg" accent="rose">
      <div className="grid gap-6 lg:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
            Année scolaire
          </span>
          <select
            value={values.schoolYear}
            onChange={(event) => onChange("schoolYear", event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          >
            {buildSchoolYearOptions().map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
            Zone académique
          </span>
          <select
            value={values.academicZone}
            onChange={(event) =>
              onChange("academicZone", event.target.value as ProgrammationFormValues["academicZone"])
            }
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          >
            <option value="A">Zone A</option>
            <option value="B">Zone B</option>
            <option value="C">Zone C</option>
          </select>
        </label>

        <div className="lg:col-span-2">
          <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
            Niveau(x)
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => toggleLevel(level)}
                className={`rounded-2xl px-4 py-2 text-sm font-light transition ${
                  values.levels.includes(level)
                    ? "bg-rose-poudre/40 text-flora-text"
                    : "bg-white/45 text-flora-text-muted hover:bg-white/70"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
            Matière
          </span>
          <select
            value={values.matiere}
            onChange={(event) => onChange("matiere", event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          >
            {MATIERE_OPTIONS.map((matiere) => (
              <option key={matiere} value={matiere}>
                {matiere}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
            Méthode
          </span>
          <select
            value={values.methode}
            onChange={(event) => onChange("methode", event.target.value)}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          >
            {METHODE_OPTIONS.map((methode) => (
              <option key={methode || "none"} value={methode}>
                {methode || "Aucune méthode imposée"}
              </option>
            ))}
          </select>
        </label>

        <label className="block lg:col-span-2">
          <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
            Projet annuel
          </span>
          <input
            value={values.projetAnnuel}
            onChange={(event) => onChange("projetAnnuel", event.target.value)}
            placeholder="Ex. Projet lecture, voyage dans le temps, arts et sciences…"
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          />
        </label>

        <label className="block lg:col-span-2">
          <span className="mb-2 block text-[11px] font-medium tracking-[0.12em] text-flora-text-subtle uppercase">
            Emploi du temps (résumé hebdomadaire)
          </span>
          <textarea
            value={JSON.stringify(values.timetable.weeklyHoursBySubject, null, 2)}
            onChange={(event) => {
              try {
                const weeklyHoursBySubject = JSON.parse(event.target.value) as Record<string, number>;
                onChange("timetable", {
                  ...values.timetable,
                  weeklyHoursBySubject,
                });
              } catch {
                // Ignore invalid JSON while typing.
              }
            }}
            rows={5}
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 font-mono text-xs font-light outline-none focus:border-rose-poudre/50 focus:ring-2 focus:ring-rose-poudre/20"
          />
        </label>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <FloraButton onClick={onGenerate} disabled={isGenerating || values.levels.length === 0}>
          {isGenerating ? "Génération en cours…" : "Générer ma programmation"}
        </FloraButton>
        {onImport ? (
          <FloraButton variant="outline" accent="sage" onClick={onImport}>
            Importer une programmation
          </FloraButton>
        ) : null}
      </div>
    </FloraCard>
  );
}
