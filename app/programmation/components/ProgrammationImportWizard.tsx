"use client";

import { useCallback, useState } from "react";
import { FloraButton } from "@/components/ui/FloraButton";
import { FloraCard } from "@/components/ui/FloraCard";
import { FloraBadge } from "@/components/ui/FloraBadge";
import type { ProgrammationPayload } from "@/lib/programming/types";
import type {
  ParsedProgrammationImport,
  ProgrammationColumnField,
  ProgrammationFormatColumn,
  ProgrammationFormatConfig,
  ProgrammationImportSession,
} from "@/lib/programming/import/types";
import {
  DEFAULT_FORMAT_COLUMNS,
  DEFAULT_FORMAT_CONFIG,
} from "@/lib/programming/import/types";
import { applyProgrammationColumnMapping, COLUMN_FIELD_LABELS } from "@/lib/programming/import/grid-parser";
import { getFormatsAcceptesLabel, getModuleAcceptAttribute } from "@/lib/import/accepted-formats";
import type { ProgrammationFormValues } from "../types";

const MAPPING_FIELDS: ProgrammationColumnField[] = [
  "period",
  "week",
  "discipline",
  "niveau",
  "sequence",
  "seance",
  "objectif",
  "competence",
  "materiel",
];

const STEPS = [
  "Importer le fichier",
  "Analyser la programmation",
  "Année scolaire et zone",
  "Adapter aux 36 semaines",
  "Mise en forme",
  "Valider et sauvegarder",
  "Utiliser dans Flora",
] as const;

type ProgrammationImportWizardProps = {
  formValues: ProgrammationFormValues;
  onComplete: (payload: ProgrammationPayload) => void;
  onClose: () => void;
};

export function ProgrammationImportWizard({
  formValues,
  onComplete,
  onClose,
}: ProgrammationImportWizardProps) {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [parsed, setParsed] = useState<ParsedProgrammationImport | null>(null);
  const [session, setSession] = useState<ProgrammationImportSession | null>(null);
  const [savedPayload, setSavedPayload] = useState<ProgrammationPayload | null>(null);
  const [formatConfig, setFormatConfig] = useState<ProgrammationFormatConfig>(DEFAULT_FORMAT_CONFIG);
  const [title, setTitle] = useState("");
  const [storagePath, setStoragePath] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [columnMapping, setColumnMapping] = useState<Partial<Record<ProgrammationColumnField, number>>>({});

  const schoolYear = formValues.schoolYear;
  const academicZone = formValues.academicZone;

  const runAnalyze = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (file) {
        const uploadForm = new FormData();
        uploadForm.append("action", "upload");
        uploadForm.append("file", file);
        const uploadResponse = await fetch("/api/programmation/import", {
          method: "POST",
          body: uploadForm,
        });
        const uploadData = (await uploadResponse.json()) as { storagePath?: string; error?: string };
        if (uploadResponse.ok && uploadData.storagePath) {
          setStoragePath(uploadData.storagePath);
        }

        const analyzeForm = new FormData();
        analyzeForm.append("action", "analyze");
        analyzeForm.append("file", file);
        if (pastedText) analyzeForm.append("pastedText", pastedText);
        const response = await fetch("/api/programmation/import", {
          method: "POST",
          body: analyzeForm,
        });
        const data = (await response.json()) as { parsed?: ParsedProgrammationImport; error?: string };
        if (!response.ok) throw new Error(data.error || "Analyse impossible.");
        setParsed(data.parsed ?? null);
        setColumnMapping(data.parsed?.columnMapping ?? {});
        setTitle(
          `Import ${data.parsed?.discipline || formValues.matiere} ${schoolYear}`,
        );
        setStep(1);
      } else if (pastedText.trim()) {
        const response = await fetch("/api/programmation/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "analyze_text",
            pastedText,
            fileName: "programmation.txt",
          }),
        });
        const data = (await response.json()) as { parsed?: ParsedProgrammationImport; error?: string };
        if (!response.ok) throw new Error(data.error || "Analyse impossible.");
        setParsed(data.parsed ?? null);
        setColumnMapping(data.parsed?.columnMapping ?? {});
        setStep(1);
      } else {
        throw new Error("Choisissez un fichier ou collez du texte.");
      }
    } catch (analyzeError) {
      setError(analyzeError instanceof Error ? analyzeError.message : "Analyse impossible.");
    } finally {
      setIsLoading(false);
    }
  }, [file, pastedText, formValues.matiere, schoolYear]);

  const runAdapt = useCallback(async () => {
    if (!parsed) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/programmation/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adapt",
          parsed,
          schoolYear,
          academicZone,
          levels: formValues.levels,
          matiere: formValues.matiere,
          formatConfig,
        }),
      });
      const data = (await response.json()) as { session?: ProgrammationImportSession; error?: string };
      if (!response.ok) throw new Error(data.error || "Adaptation impossible.");
      setSession(data.session ?? null);
      setStep(3);
    } catch (adaptError) {
      setError(adaptError instanceof Error ? adaptError.message : "Adaptation impossible.");
    } finally {
      setIsLoading(false);
    }
  }, [parsed, schoolYear, academicZone, formValues.levels, formValues.matiere, formatConfig]);

  const runSave = useCallback(async () => {
    if (!parsed) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/programmation/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          parsed,
          schoolYear,
          academicZone,
          levels: formValues.levels,
          matiere: formValues.matiere,
          formatConfig,
          title,
          sourceStoragePath: storagePath,
          sourceFileName: file?.name,
        }),
      });
      const data = (await response.json()) as ProgrammationPayload & { error?: string };
      if (!response.ok) throw new Error(data.error || "Sauvegarde impossible.");
      setSavedPayload(data);
      setStep(6);
      onComplete(data);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Sauvegarde impossible.");
    } finally {
      setIsLoading(false);
    }
  }, [
    parsed,
    schoolYear,
    academicZone,
    formValues.levels,
    formValues.matiere,
    formatConfig,
    title,
    storagePath,
    file?.name,
    onComplete,
  ]);

  function toggleColumn(column: ProgrammationFormatColumn) {
    setFormatConfig((current) => {
      const has = current.columns.includes(column);
      return {
        ...current,
        columns: has
          ? current.columns.filter((item) => item !== column)
          : [...current.columns, column],
      };
    });
  }

  function applyColumnMapping() {
    if (!parsed) return;
    const updated = applyProgrammationColumnMapping(parsed, columnMapping);
    setParsed(updated);
    setColumnMapping(updated.columnMapping ?? columnMapping);
  }

  function updateColumnMapping(field: ProgrammationColumnField, columnIndex: number | "") {
    setColumnMapping((current) => {
      const next = { ...current };
      if (columnIndex === "") {
        delete next[field];
      } else {
        next[field] = columnIndex;
      }
      return next;
    });
  }

  return (
    <FloraCard padding="lg" accent="lavender" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-serif text-2xl font-medium">Importer une programmation</h3>
          <p className="mt-1 text-sm font-light text-flora-text-subtle">
            Étape {step + 1} / {STEPS.length} — {STEPS[step]}
          </p>
        </div>
        <FloraButton variant="ghost" onClick={onClose}>
          Fermer
        </FloraButton>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <FloraBadge key={label} accent={index === step ? "sage" : "cream"}>
            {index + 1}. {label}
          </FloraBadge>
        ))}
      </div>

      {error ? (
        <p className="rounded-2xl bg-rose-soft/35 px-4 py-3 text-sm text-[#b88989]">{error}</p>
      ) : null}

      {step === 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Fichier (PDF, CSV, Word, Excel, JPG, JPEG, PNG)
            </span>
            <input
              type="file"
              accept={getModuleAcceptAttribute("programmation")}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-flora-text-subtle">
              {getFormatsAcceptesLabel("programmation")}. Les images sont analysées par OCR.
            </span>
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Ou texte copié-collé (tableau)
            </span>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              className="min-h-32 w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
              placeholder="Période;Semaine;Discipline;Séance;Compétence;Objectif…"
            />
          </label>
          <FloraButton onClick={() => void runAnalyze()} disabled={isLoading}>
            {isLoading ? "Analyse…" : "Analyser"}
          </FloraButton>
        </div>
      ) : null}

      {step === 1 && parsed ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <FloraBadge accent="sage">{parsed.rowCount} ligne(s) détectée(s)</FloraBadge>
            {parsed.sheetName ? (
              <FloraBadge accent="cream">Feuille : {parsed.sheetName}</FloraBadge>
            ) : null}
            {parsed.discipline ? (
              <FloraBadge accent="lavender">Discipline : {parsed.discipline}</FloraBadge>
            ) : null}
            {parsed.niveau ? <FloraBadge accent="cream">Niveau : {parsed.niveau}</FloraBadge> : null}
          </div>

          {parsed.sheetNames && parsed.sheetNames.length > 1 ? (
            <p className="text-xs font-light text-flora-text-subtle">
              Feuilles disponibles : {parsed.sheetNames.join(", ")}
            </p>
          ) : null}

          {Object.keys(parsed.detectedFields).length > 0 ? (
            <div className="rounded-2xl bg-white/50 p-3">
              <p className="mb-2 text-xs uppercase tracking-wide text-flora-text-subtle">
                Colonnes détectées
              </p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(parsed.detectedFields).map(([field, label]) => (
                  <span
                    key={field}
                    className="rounded-full bg-sauge/20 px-2.5 py-1 text-xs text-flora-text"
                  >
                    {COLUMN_FIELD_LABELS[field as ProgrammationColumnField] ?? field} : {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {parsed.warnings.map((warning) => (
            <p key={warning} className="text-sm text-[#b88989]">
              {warning}
            </p>
          ))}

          {parsed.columns.length > 0 ? (
            <div className="overflow-x-auto rounded-2xl border border-white/60 bg-white/50">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/60 bg-white/40">
                    {parsed.columns.map((column, index) => (
                      <th key={`${column}-${index}`} className="px-3 py-2 font-medium text-flora-text">
                        {column || `Colonne ${index + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.previewRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-white/40 last:border-0">
                      {parsed.columns.map((_, colIndex) => (
                        <td key={colIndex} className="px-3 py-2 font-light text-flora-text-muted">
                          {row[colIndex] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl bg-white/50 p-3 text-sm font-light text-flora-text-muted">
              {parsed.extractedTextPreview}
            </div>
          )}

          {parsed.needsColumnMapping && parsed.columns.length > 0 ? (
            <div className="rounded-2xl bg-white/50 p-4">
              <p className="mb-3 text-sm font-medium text-flora-text-muted">
                Correspondance des colonnes
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {MAPPING_FIELDS.map((field) => (
                  <label key={field} className="block text-xs text-flora-text-subtle">
                    {COLUMN_FIELD_LABELS[field]}
                    <select
                      className="mt-1 w-full rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm"
                      value={columnMapping[field] ?? ""}
                      onChange={(event) =>
                        updateColumnMapping(
                          field,
                          event.target.value === "" ? "" : Number(event.target.value),
                        )
                      }
                    >
                      <option value="">— Non utilisée —</option>
                      {parsed.columns.map((column, index) => (
                        <option key={`${field}-${index}`} value={index}>
                          {column || `Colonne ${index + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <FloraButton className="mt-4" variant="secondary" onClick={applyColumnMapping}>
                Appliquer les correspondances
              </FloraButton>
            </div>
          ) : null}

          <FloraButton
            onClick={() => setStep(2)}
            disabled={parsed.rowCount === 0 || parsed.needsColumnMapping}
          >
            Continuer
          </FloraButton>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <p className="text-sm font-light text-flora-text-muted">
            Année {schoolYear} · Zone {academicZone} · Niveaux {formValues.levels.join(", ")}
          </p>
          <p className="text-sm font-light text-flora-text-subtle">
            Ces paramètres proviennent de votre profil pédagogique et du formulaire programmation.
          </p>
          <FloraButton onClick={() => void runAdapt()} disabled={isLoading}>
            {isLoading ? "Adaptation…" : "Adapter aux 36 semaines"}
          </FloraButton>
        </div>
      ) : null}

      {step === 3 && session ? (
        <div className="space-y-4">
          <p className="text-sm font-light text-flora-text-muted">
            {session.adaptation.sourceWeekCount} séances → {session.adaptation.targetWeekCount}{" "}
            semaines de classe · Stratégie : {session.adaptation.strategy}
          </p>
          {session.adaptation.conflicts.map((conflict) => (
            <p key={conflict.code} className="text-sm text-[#b88989]">
              {conflict.message}
            </p>
          ))}
          {session.adaptation.suggestions.map((suggestion) => (
            <p key={suggestion} className="text-sm text-flora-text-subtle">
              {suggestion}
            </p>
          ))}
          <FloraButton onClick={() => setStep(4)}>Configurer la mise en forme</FloraButton>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="space-y-4">
          <p className="text-sm font-light text-flora-text-muted">Colonnes à afficher</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_FORMAT_COLUMNS.map((column) => (
              <button
                key={column}
                type="button"
                onClick={() => toggleColumn(column)}
                className={`rounded-full px-3 py-1 text-xs ${
                  formatConfig.columns.includes(column)
                    ? "bg-sauge/30 text-flora-text"
                    : "bg-white/50 text-flora-text-subtle"
                }`}
              >
                {column}
              </button>
            ))}
          </div>
          <FloraButton onClick={() => setStep(5)}>Valider la mise en forme</FloraButton>
        </div>
      ) : null}

      {step === 5 ? (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-[11px] uppercase tracking-wide text-flora-text-subtle">
              Titre de la programmation
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-white/70 bg-white/60 px-3 py-2"
            />
          </label>
          {session?.competencyMatches.length ? (
            <div className="rounded-2xl bg-white/50 p-4 text-sm">
              <p className="font-medium text-flora-text-muted">Correspondances BO</p>
              <ul className="mt-2 space-y-1 font-light text-flora-text-subtle">
                {session.competencyMatches.slice(0, 8).map((match) => (
                  <li key={match.importedLabel}>
                    {match.importedLabel} → {match.matchedLabel || "—"} ({match.status})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <FloraButton onClick={() => void runSave()} disabled={isLoading || !title.trim()}>
            {isLoading ? "Sauvegarde…" : "Sauvegarder"}
          </FloraButton>
        </div>
      ) : null}

      {step === 6 && savedPayload ? (
        <div className="space-y-4">
          <p className="text-sm font-light text-flora-text-muted">
            Programmation enregistrée. Utilisable dans Progression, Séquences, Séances et Cahier
            journal.
          </p>
          <div className="flex flex-wrap gap-3">
            <FloraButton onClick={onClose}>Voir la programmation</FloraButton>
          </div>
        </div>
      ) : null}
    </FloraCard>
  );
}
