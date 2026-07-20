"use client";

import type { ReactNode } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import {
  KNOWN_SUBJECTS,
  normalizeMatiere,
  normalizeSousMatiere,
  subSubjectsForMatiere,
} from "@/lib/pedagogical/subjects";

export type ImportMetadataValues = {
  title: string;
  matiere: string;
  sousMatiere: string;
  niveau: string;
  periode: string;
  documentType: string;
};

type ImportMetadataFormProps = {
  values: ImportMetadataValues;
  onChange: (key: keyof ImportMetadataValues, value: string) => void;
};

export function ImportMetadataForm({ values, onChange }: ImportMetadataFormProps) {
  const matiere = normalizeMatiere(values.matiere);
  const subSubjects = subSubjectsForMatiere(matiere);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block text-sm md:col-span-2">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
          Titre
        </span>
        <input
          type="text"
          value={values.title}
          onChange={(event) => onChange("title", event.target.value)}
          className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
          Matière
        </span>
        <select
          value={matiere}
          onChange={(event) => {
            onChange("matiere", event.target.value);
            onChange("sousMatiere", "");
          }}
          className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
        >
          <option value="">— Choisir —</option>
          {KNOWN_SUBJECTS.map((subject) => (
            <option key={subject} value={subject}>
              {subject}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
          Sous-matière
        </span>
        {subSubjects.length > 0 ? (
          <select
            value={values.sousMatiere}
            onChange={(event) =>
              onChange("sousMatiere", normalizeSousMatiere(event.target.value, matiere))
            }
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {subSubjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={values.sousMatiere}
            onChange={(event) =>
              onChange("sousMatiere", normalizeSousMatiere(event.target.value, matiere))
            }
            className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
          />
        )}
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
          Niveau
        </span>
        <input
          type="text"
          value={values.niveau}
          onChange={(event) => onChange("niveau", event.target.value)}
          className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
          Période
        </span>
        <input
          type="text"
          value={values.periode}
          onChange={(event) => onChange("periode", event.target.value)}
          className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm md:col-span-2">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
          Type de document
        </span>
        <input
          type="text"
          value={values.documentType}
          onChange={(event) => onChange("documentType", event.target.value)}
          className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
        />
      </label>
    </div>
  );
}

type PedagogicalModuleToolbarProps = {
  importLabel: string;
  onImport: () => void;
  onCreateManual?: () => void;
  onDuplicate?: () => void;
  extraActions?: ReactNode;
};

export function PedagogicalModuleToolbar({
  importLabel,
  onImport,
  onCreateManual,
  onDuplicate,
  extraActions,
}: PedagogicalModuleToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FloraButton onClick={onImport}>{importLabel}</FloraButton>
      {onCreateManual ? (
        <FloraButton variant="secondary" onClick={onCreateManual}>
          Créer manuellement
        </FloraButton>
      ) : null}
      {onDuplicate ? (
        <FloraButton variant="ghost" onClick={onDuplicate}>
          Dupliquer
        </FloraButton>
      ) : null}
      {extraActions}
    </div>
  );
}
